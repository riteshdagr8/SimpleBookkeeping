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
import { generateObligationsForClient } from "../src/lib/services/obligations";

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

  // --- 4. Reconcile invalid Pending obligations -------------------
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      entityType: true,
      incorporationJurisdiction: true,
      incorporationDate: true,
      hstApplicable: true,
      hstFrequency: true,
      fiscalYearEnd: true,
      payrollApplicable: true,
      payrollFrequency: true,
      remitterType: true,
      reviewComplete: true,
    },
  });
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

    // Any auto-generated Pending row whose filing type is invalid under the new
    // entity/jurisdiction can never become valid again — delete it regardless of
    // due date (future, past-due, or none). Historical / completed rows are
    // never touched (they are not Pending).
    const invalid = await prisma.filingObligation.findMany({
      where: {
        clientId: c.id,
        autoGenerated: true,
        status: "Pending",
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
      console.log(`  reconcile: deleted ${toDelete.length} invalid Pending obligations for ${describe(c.id)}`);
    }
  }

  // --- 5. Clients that need a schedule REGENERATION -----------------------
  // A client needs regeneration when it's missing filing types the new rules
  // would generate. Only the recurring/rolling types (sales tax, payroll
  // remittance, payroll processing) are reliable signals — a recurring type
  // should always have rows in the window. One-shot types (T2/T1/T3, annual
  // returns, info returns) may legitimately be absent if out of window, so
  // their absence isn't flagged. Stale types were already purged by the
  // reconcile (step 4); completed historical rows are kept by design and are
  // not actionable.
  const regen: Array<{ id: string; name: string; missing: string[] }> = [];
  const ROLLING_TYPES = ["HST", "GST", "GSTQST", "PST", "RST", "PayrollRemittance", "PayrollProcessing"];
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

    const missing = [...valid].filter((t) => ROLLING_TYPES.includes(t) && !presentSet.has(t));

    // Sales-tax types can't generate when the SE-annual rule applies but the
    // FYE isn't Dec 31 (the generator returns no periods) — don't flag those as
    // a regeneration miss.
    const fye = c.fiscalYearEnd;
    const seAnnualBlocked =
      (c.hstFrequency === "SelfEmployed" ||
        (c.hstFrequency === "Annual" &&
          (c.entityType === "Self-Employed" || c.entityType === "Individual"))) &&
      !!fye &&
      (fye.getUTCMonth() !== 11 || fye.getUTCDate() !== 31);
    const actionable = seAnnualBlocked
      ? missing.filter((t) => !["HST", "GST", "GSTQST", "PST", "RST"].includes(t))
      : missing;

    if (actionable.length > 0) {
      regen.push({ id: c.id, name: names.get(c.id) ?? c.id, missing: actionable });
    }
  }

  // --- 5. Regenerate schedules for affected clients -----------------------
  // The rename and reconcile only relabel/delete existing rows; regeneration is
  // what CREATES the new filing types (T1/T3, GST/PST/RST, ProvincialAR for
  // newly-covered provinces, etc.). Run the generator for every client that
  // needs it and has a completed review. The generator is idempotent.
  const tenant = await prisma.tenant.findFirst({ select: { id: true } });
  const actor = await prisma.user.findFirst({
    where: { tenantId: tenant?.id ?? "", role: "Admin" },
    select: { id: true },
  });
  const regenerated: Array<{ name: string; created: number }> = [];
  const needsManual: Array<{ id: string; name: string; reason: string }> = [];

  for (const c of regen) {
    const clientRow = clients.find((x) => x.id === c.id);
    if (!tenant || !actor) {
      needsManual.push({ id: c.id, name: c.name, reason: "no tenant/admin actor available" });
      continue;
    }
    if (!clientRow?.reviewComplete) {
      needsManual.push({ id: c.id, name: c.name, reason: "historical review not complete — regenerate manually" });
      continue;
    }
    const before = await prisma.filingObligation.count({ where: { clientId: c.id } });
    const res = await generateObligationsForClient(tenant.id, actor.id, c.id);
    if ("error" in res) {
      needsManual.push({ id: c.id, name: c.name, reason: res.error ?? "unknown" });
    } else {
      const after = await prisma.filingObligation.count({ where: { clientId: c.id } });
      const delta = after - before;
      regenerated.push({ name: c.name, created: delta });
      console.log(`  regenerated: ${describe(c.id)} (${delta >= 0 ? "+" : ""}${delta} obligations)`);
    }
  }

  // --- Summary -----------------------------------------------------------
  console.log("\n=== SUMMARY ===");
  console.log(`Jurisdiction codes updated:     ${jurChanged}`);
  console.log(`Remitter types updated:         ${remitterChanged}`);
  console.log(`OntarioAnnualReturn renamed:    ${renamed.count}`);
  console.log(`Invalid Pending deleted: ${deletedTotal}`);
  for (const [t, n] of [...deletedByType.entries()].sort()) {
    console.log(`  - ${label(t)}: ${n}`);
  }
  console.log(`Schedules regenerated:          ${regenerated.length}`);
  for (const r of regenerated.sort((a, b) => a.name.localeCompare(b.name))) {
    console.log(`  - ${r.name}: ${r.created >= 0 ? "+" : ""}${r.created} obligations`);
  }
  if (needsManual.length > 0) {
    console.log(`\n=== STILL NEED MANUAL REGENERATION (${needsManual.length}) ===`);
    for (const m of needsManual.sort((a, b) => a.name.localeCompare(b.name))) {
      console.log(`  - ${m.name} (${m.id}): ${m.reason}`);
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

