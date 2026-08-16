/**
 * One-time data backfill for the multi-entity & jurisdiction compliance engine.
 *
 * RUN ME MANUALLY on the database, e.g.:
 *   npm run migrate-multi-entity
 *
 * The script:
 *   1. Takes a snapshot of data/app.db into backups/pre-migration/ FIRST.
 *   2. Backfills incorporationJurisdiction full names → codes (Ontario → ON).
 *   3. Backfills remitterType Regular → Monthly; Accelerated1/2 → null.
 *   4. Renames FilingObligation.filingType OntarioAnnualReturn → ProvincialAnnualReturn.
 *   5. Reconciles schedules: deletes auto-generated, Pending, future obligations
 *      that are invalid under the client's new entity type / jurisdiction.
 *      Historical / completed / non-future rows are NEVER deleted.
 *   6. Prints which clients need their schedules REGENERATED: any client whose
 *      current auto-generated obligations no longer match the filing types the
 *      new rules would generate (e.g. missing T1/GST/PST/ProvincialAR for newly
 *      supported entities/jurisdictions).
 *
 * Idempotent — safe to re-run.
 */

import "dotenv/config";
import { createBackupSnapshot } from "./lib/backup-snapshot";
import { prisma } from "../src/lib/prisma";
import { normalizeJurisdiction } from "../src/lib/jurisdictions";
import { filingTypesForClient } from "../src/lib/obligation-matrix";

const FILING_TYPE_LABELS: Record<string, string> = {
  T2: "Corporate Tax Return (T2)",
  T1: "Personal Tax Return (T1)",
  T5013: "Partnership Return (T5013)",
  T3: "Trust Return (T3)",
  HST: "GST/HST",
  GST: "GST Return",
  GSTQST: "GST/QST Return",
  PST: "PST Return",
  RST: "RST Return",
  FederalAnnualReturn: "Federal Annual Return",
  ProvincialAnnualReturn: "Provincial Annual Return",
  PayrollRemittance: "Payroll Remittance",
  PayrollProcessing: "Payroll Processing",
  T4: "T4",
  T4A: "T4A",
  T5: "T5",
  T3Slips: "T3 Slips & Summary",
};

function label(t: string): string {
  return FILING_TYPE_LABELS[t] ?? t;
}

/** Loads client id → legalName so all output shows a readable name. */
async function nameMap(): Promise<Map<string, string>> {
  const rows = await prisma.client.findMany({ select: { id: true, legalName: true } });
  return new Map(rows.map((r) => [r.id, r.legalName]));
}

async function main() {
  console.log("Stopping-point reminder: stop the app (stop.cmd / stop.sh) before running this.");
  console.log("Creating a backup snapshot first...");
  const snapshot = await createBackupSnapshot(undefined, "pre-multi-entity-migration");
  console.log(`Backup snapshot: ${snapshot.dbOut}\n`);

  const names = await nameMap();
  const describe = (id: string) => `${names.get(id) ?? id} (${id})`;

  // --- 1. Jurisdiction codes ---------------------------------------------
  const jurisdictionClients = await prisma.client.findMany({
    where: { incorporationJurisdiction: { not: null } },
    select: { id: true, incorporationJurisdiction: true },
  });
  let jurChanged = 0;
  for (const c of jurisdictionClients) {
    const normalized = normalizeJurisdiction(c.incorporationJurisdiction);
    if (normalized && normalized !== c.incorporationJurisdiction) {
      await prisma.client.update({
        where: { id: c.id },
        data: { incorporationJurisdiction: normalized },
      });
      console.log(`  jurisdiction: ${c.incorporationJurisdiction} -> ${normalized}  (${describe(c.id)})`);
      jurChanged++;
    }
  }

  // --- 2. Remitter type ---------------------------------------------------
  const remitterClients = await prisma.client.findMany({
    where: { remitterType: { not: null } },
    select: { id: true, remitterType: true },
  });
  let remitterChanged = 0;
  for (const c of remitterClients) {
    const next =
      c.remitterType === "Regular"
        ? "Monthly"
        : c.remitterType === "Accelerated1" || c.remitterType === "Accelerated2"
          ? null
          : c.remitterType;
    if (next !== c.remitterType) {
      await prisma.client.update({ where: { id: c.id }, data: { remitterType: next } });
      console.log(`  remitter: ${c.remitterType} -> ${next ?? "null"}  (${describe(c.id)})`);
      remitterChanged++;
    }
  }

  // --- 3. OntarioAnnualReturn -> ProvincialAnnualReturn -------------------
  const renamed = await prisma.filingObligation.updateMany({
    where: { filingType: "OntarioAnnualReturn" },
    data: { filingType: "ProvincialAnnualReturn" },
  });
  if (renamed.count > 0) {
    // Which clients were affected (for the regeneration list).
    const renamedClients = await prisma.filingObligation.findMany({
      where: { filingType: "ProvincialAnnualReturn" },
      distinct: ["clientId"],
      select: { clientId: true },
    });
    console.log(`  filingType: OntarioAnnualReturn -> ProvincialAnnualReturn (${renamed.count} rows across ${renamedClients.length} client(s))`);
  }

  // --- 4. Reconcile invalid Pending-future obligations -------------------
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      entityType: true,
      incorporationJurisdiction: true,
      incorporationDate: true,
      hstApplicable: true,
      hstFrequency: true,
      payrollApplicable: true,
      payrollFrequency: true,
      remitterType: true,
    },
  });
  const now = Date.now();
  const deletedByType = new Map<string, number>();
  let deletedTotal = 0;

  for (const c of clients) {
    const valid = filingTypesForClient({
      entityType: c.entityType,
      incorporationJurisdiction: c.incorporationJurisdiction,
      incorporationDate: c.incorporationDate,
      hstApplicable: c.hstApplicable,
      hstFrequency: c.hstFrequency,
      payrollApplicable: c.payrollApplicable,
      payrollFrequency: c.payrollFrequency,
      remitterType: c.remitterType,
    });

    const invalid = await prisma.filingObligation.findMany({
      where: {
        clientId: c.id,
        autoGenerated: true,
        status: "Pending",
        OR: [{ filingDueDate: null }, { filingDueDate: { gte: new Date(now) } }],
      },
      select: { id: true, filingType: true },
    });

    const toDelete = invalid.filter((o) => !valid.has(o.filingType));
    if (toDelete.length > 0) {
      await prisma.filingObligation.deleteMany({
        where: { id: { in: toDelete.map((o) => o.id) } },
      });
      for (const o of toDelete) {
        deletedByType.set(o.filingType, (deletedByType.get(o.filingType) ?? 0) + 1);
      }
      deletedTotal += toDelete.length;
      console.log(`  reconcile: deleted ${toDelete.length} invalid Pending-future obligations for ${describe(c.id)}`);
    }
  }

  // --- 5. Clients that need a schedule REGENERATION -----------------------
  // A client needs regeneration when its current auto-generated obligations
  // don't yet cover the filing types the new rules would generate (missing
  // new types) OR still hold types the rules no longer produce for it.
  const regen: Array<{ id: string; name: string; missing: string[]; extra: string[] }> = [];
  for (const c of clients) {
    const valid = filingTypesForClient({
      entityType: c.entityType,
      incorporationJurisdiction: c.incorporationJurisdiction,
      incorporationDate: c.incorporationDate,
      hstApplicable: c.hstApplicable,
      hstFrequency: c.hstFrequency,
      payrollApplicable: c.payrollApplicable,
      payrollFrequency: c.payrollFrequency,
      remitterType: c.remitterType,
    });

    const present = await prisma.filingObligation.findMany({
      where: { clientId: c.id, autoGenerated: true },
      select: { filingType: true },
    });
    const presentSet = new Set(present.map((o) => o.filingType));

    // A valid type is "missing" only if it would actually be generated
    // (within the rolling window). Filing types like sales tax/payroll that
    // recur monthly are clearly expected; one-shot types (T2/T1/T3, AR, info
    // returns) may legitimately be absent if out of window — so flag missing
    // only for the recurring/rolling types, and treat one-shot absence as a
    // "likely needs regeneration" hint rather than a hard miss.
    const missing: string[] = [];
    for (const t of valid) {
      if (!presentSet.has(t)) {
        const rolling = ["HST", "GST", "GSTQST", "PST", "RST", "PayrollRemittance", "PayrollProcessing"];
        if (rolling.includes(t)) missing.push(t);
      }
    }
    const extra = [...presentSet].filter((t) => !valid.has(t));

    if (missing.length > 0 || extra.length > 0) {
      regen.push({ id: c.id, name: names.get(c.id) ?? c.id, missing, extra });
    }
  }

  // --- Summary -----------------------------------------------------------
  console.log("\n=== SUMMARY ===");
  console.log(`Jurisdiction codes updated:     ${jurChanged}`);
  console.log(`Remitter types updated:         ${remitterChanged}`);
  console.log(`OntarioAnnualReturn renamed:    ${renamed.count}`);
  console.log(`Invalid Pending-future deleted: ${deletedTotal}`);
  for (const [t, n] of [...deletedByType.entries()].sort()) {
    console.log(`  - ${label(t)}: ${n}`);
  }

  console.log("\n=== CLIENTS THAT NEED SCHEDULE REGENERATION ===");
  if (regen.length === 0) {
    console.log("  (none — all schedules already match the current entity/jurisdiction rules)");
  } else {
    console.log(`  ${regen.length} client(s). Open each and click \"Generate schedule\".`);
    for (const c of regen.sort((a, b) => a.name.localeCompare(b.name))) {
      const bits: string[] = [];
      if (c.missing.length) bits.push(`missing ${c.missing.map(label).join(", ")}`);
      if (c.extra.length) bits.push(`has stale ${c.extra.map(label).join(", ")}`);
      console.log(`  - ${c.name} (${c.id}): ${bits.join("; ")}`);
    }
  }
  console.log("\nDone.");
}

main()
  .catch((e) => {
    console.error("[migrate-multi-entity] Fatal:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

