/**
 * One-time backfill: fiscal year-end day-of-month → last day of that month.
 *
 * A client's FYE used to store only the month, hard-coded to day 01 (e.g.
 * 2026-03-01). The compliance date math reads the day (T2 filing due = FYE + 6
 * months, self-employed HST requires a Dec 31 year-end, …), so the fiscal
 * year-end must be the LAST day of the month (2026-03-31). This script moves
 * every client's FYE to month-end and re-derives the dates of their existing
 * auto-generated Pending obligations so the schedule stays consistent — in
 * place, keeping each row's id (and therefore its workflow rows and
 * interactions).
 *
 *   npx tsx scripts/backfill-fye-last-day.ts          # dry run — prints the plan
 *   npx tsx scripts/backfill-fye-last-day.ts --apply  # writes (backup first)
 *
 * Filed/Completed obligations and past-due rows are never modified.
 * Idempotent — safe to re-run.
 */

import "dotenv/config";
import { createBackupSnapshot } from "./lib/backup-snapshot";
import { prisma } from "../src/lib/prisma";
import {
  reconcilePendingObligations,
  type ObligationDateChange,
} from "../src/lib/services/obligations";

const APPLY = process.argv.includes("--apply");
// How far back to correct already-past rows. The generator only manages the
// current + future window, so past rows are normally left alone; this pass
// reaches back so a client whose schedule was built by the old day-01 rules has
// its overdue rows corrected too. 0 keeps the conservative future-only scope.
const PAST_MONTHS = (() => {
  const raw = process.argv.find((a) => a.startsWith("--past-months="));
  return raw ? Math.max(0, Number(raw.slice("--past-months=".length)) || 0) : 0;
})();

/** Midnight-UTC first day of the month containing `d`. */
function monthStart(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Midnight-UTC last day of the month containing `d`. */
function monthEnd(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

function iso(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "—";
}

function changed(a: Date | null, b: Date | null): boolean {
  return (a?.getTime() ?? -1) !== (b?.getTime() ?? -1);
}

function describeChange(c: ObligationDateChange): string {
  const parts: string[] = [];
  if (changed(c.before.filingDueDate, c.after.filingDueDate)) {
    parts.push(`filing ${iso(c.before.filingDueDate)} → ${iso(c.after.filingDueDate)}`);
  }
  if (changed(c.before.paymentDueDate, c.after.paymentDueDate)) {
    parts.push(`payment ${iso(c.before.paymentDueDate)} → ${iso(c.after.paymentDueDate)}`);
  }
  if (changed(c.before.periodStart, c.after.periodStart) || changed(c.before.periodEnd, c.after.periodEnd)) {
    parts.push(`period ${iso(c.before.periodStart)}–${iso(c.before.periodEnd)} → ${iso(c.after.periodStart)}–${iso(c.after.periodEnd)}`);
  }
  return parts.join(", ") || "dates unchanged";
}

async function main() {
  console.log("=== FYE backfill: fiscal year-end → last day of the month ===");
  console.log(APPLY ? "Mode: APPLY (writing)\n" : "Mode: DRY RUN — nothing written (re-run with --apply)\n");
  console.log(
    PAST_MONTHS > 0
      ? `Also correcting rows up to ${PAST_MONTHS} months past due (--past-months=${PAST_MONTHS}).\n`
      : "Scope: current + future rows only (pass --past-months=N to also correct past-due rows).\n"
  );

  const clients = await prisma.client.findMany({
    orderBy: { fileNumber: "asc" },
    select: { id: true, tenantId: true, fileNumber: true, legalName: true, fiscalYearEnd: true },
  });

  // The legacy convention stored the FYE on day 01 of the month; a fiscal
  // year-end is really the LAST day. Every client is reconciled over
  // first-of-month → last-of-month so obligations generated from a day-01 FYE
  // are still corrected when the client row has already been moved to month-end.
  const rows = clients.map((c) => ({
    ...c,
    from: monthStart(c.fiscalYearEnd),
    to: monthEnd(c.fiscalYearEnd),
  }));
  const fyeChanges = rows.filter((c) => c.to.getTime() !== c.fiscalYearEnd.getTime());

  console.log(`Clients: ${rows.length} total; ${fyeChanges.length} need the FYE moved to month-end.`);
  for (const c of fyeChanges) {
    console.log(
      `  ${(c.fileNumber ?? "—").padEnd(14)} ${c.legalName.slice(0, 34).padEnd(36)} ${iso(c.fiscalYearEnd)} → ${iso(c.to)}`
    );
  }
  if (fyeChanges.length === 0) console.log("  (no client rows need updating)");

  let actorId: string | null = null;
  if (APPLY) {
    const actor =
      (await prisma.user.findFirst({ where: { role: "Admin" }, select: { id: true } })) ??
      (await prisma.user.findFirst({ select: { id: true } }));
    if (!actor) throw new Error("No user row found to attribute the audit log to — cannot apply.");
    actorId = actor.id;

    console.log("\nCreating a backup snapshot first...");
    const snapshot = await createBackupSnapshot(undefined, "pre-fye-last-day-backfill");
    console.log(`Backup snapshot: ${snapshot.dbOut}`);
  }

  console.log("\n--- Obligation reconciliation (auto-generated Pending, future) ---");
  let clientsWritten = 0;
  let totalChanges = 0;
  let totalDeletes = 0;

  for (const c of rows) {
    // Reconcile before writing the client row. The reconcile is idempotent, so
    // if a later step fails the re-run still heals it.
    const plan = await reconcilePendingObligations(
      c.tenantId,
      actorId,
      c.id,
      APPLY,
      { from: c.from, to: c.to },
      { pastMonths: PAST_MONTHS }
    );
    if (APPLY && c.to.getTime() !== c.fiscalYearEnd.getTime()) {
      await prisma.client.update({ where: { id: c.id }, data: { fiscalYearEnd: c.to } });
      clientsWritten++;
    }
    if (!plan || (plan.changes.length === 0 && plan.deletions.length === 0)) continue;

    console.log(`\n  ${c.legalName} (${c.fileNumber ?? "—"})`);
    for (const ch of plan.changes) {
      console.log(`    ${ch.filingType.padEnd(22)} ${describeChange(ch)}`);
    }
    for (const d of plan.deletions) {
      console.log(`    ${d.filingType.padEnd(22)} delete (filing type no longer valid)`);
    }
    totalChanges += plan.changes.length;
    totalDeletes += plan.deletions.length;
  }

  console.log("\n=== SUMMARY ===");
  console.log(`  Clients ${APPLY ? "updated" : "to update"}           : ${APPLY ? clientsWritten : fyeChanges.length}`);
  console.log(`  Obligation rows ${APPLY ? "rewritten" : "to rewrite"} : ${totalChanges}`);
  console.log(`  Obligation rows ${APPLY ? "deleted" : "to delete"}   : ${totalDeletes}`);
  if (!APPLY) {
    console.log("\nDry run — nothing was written. Re-run with --apply to write these changes.");
  }
}

main()
  .catch((e) => {
    console.error("\nBackfill failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
