"use client";

import Link from "next/link";
import { filingTypeLabel } from "@/lib/obligation-matrix";
import { frequencyForPeriod } from "@/lib/payroll-frequency";
import { SortableTh, useSort, type SortValue } from "@/components/sortable";
import type { ListedWorkflow } from "@/lib/workflows/service";

/** Which obligation date the table's date column shows. */
export type DateColumn = "filingDue" | "periodEnd";

/** Optional columns a list page can add after Type. */
export type ExtraColumn = "fye" | "frequency" | "amount" | "incorporationMonth";

const EXTRA_LABELS: Record<ExtraColumn, string> = {
  fye: "Fiscal year end",
  frequency: "Frequency",
  amount: "Amount",
  incorporationMonth: "Incorporation month",
};

function formatUTC(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

const CAD = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

const MONTH_LONG = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long" });

function dateOf(r: ListedWorkflow, column: DateColumn): Date | null {
  return column === "periodEnd" ? r.obligation.periodEnd : r.obligation.filingDueDate;
}

/** T4A and T5 are the only information returns with an amount. */
function amountOf(r: ListedWorkflow): number | null {
  if (r.obligation.filingType !== "T4A" && r.obligation.filingType !== "T5") return null;
  return r.obligation.amount;
}

export function WorkflowTable({
  rows,
  slug,
  extraColumns,
  dateColumn,
}: {
  rows: ListedWorkflow[];
  slug: string;
  extraColumns: ExtraColumn[];
  dateColumn: DateColumn;
}) {
  const dateLabel = dateColumn === "periodEnd" ? "Period ending" : "Filing due";
  const accessors: Record<string, (r: ListedWorkflow) => SortValue> = {
    client: (r) => r.client.legalName,
    type: (r) => filingTypeLabel(r.obligation.filingType, r.client.incorporationJurisdiction),
    fye: (r) => r.client.fiscalYearEnd.getTime(),
    frequency: (r) =>
      r.obligation.periodStart && r.obligation.periodEnd
        ? frequencyForPeriod(r.obligation.periodStart, r.obligation.periodEnd)
        : null,
    amount: (r) => amountOf(r),
    incorporationMonth: (r) =>
      r.client.incorporationDate ? r.client.incorporationDate.getUTCMonth() : null,
    date: (r) => dateOf(r, dateColumn)?.getTime() ?? null,
    status: (r) => r.status,
    updated: (r) => r.updatedAt.getTime(),
  };
  const { sorted, sortBy, sortDir, toggle } = useSort(rows, "date", accessors);
  const columns = 5 + extraColumns.length;

  function extraCell(col: ExtraColumn, r: ListedWorkflow) {
    switch (col) {
      case "fye":
        return formatUTC(r.client.fiscalYearEnd);
      case "frequency": {
        const f = r.obligation.periodStart && r.obligation.periodEnd
          ? frequencyForPeriod(r.obligation.periodStart, r.obligation.periodEnd)
          : null;
        return f ?? "—";
      }
      case "amount": {
        const a = amountOf(r);
        return a == null ? "—" : CAD.format(a);
      }
      case "incorporationMonth":
        return r.client.incorporationDate ? MONTH_LONG.format(r.client.incorporationDate) : "—";
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <table className="min-w-full text-sm">
        <thead className="bg-bg-subtle text-left text-xs text-fg-muted">
          <tr>
            <SortableTh label="Client" sortKey="client" sortBy={sortBy} sortDir={sortDir} onToggle={toggle} />
            <SortableTh label="Type" sortKey="type" sortBy={sortBy} sortDir={sortDir} onToggle={toggle} />
            {extraColumns.map((col) => (
              <SortableTh
                key={col}
                label={EXTRA_LABELS[col]}
                sortKey={col}
                sortBy={sortBy}
                sortDir={sortDir}
                onToggle={toggle}
              />
            ))}
            <SortableTh label={dateLabel} sortKey="date" sortBy={sortBy} sortDir={sortDir} onToggle={toggle} />
            <SortableTh label="Status" sortKey="status" sortBy={sortBy} sortDir={sortDir} onToggle={toggle} />
            <SortableTh label="Updated" sortKey="updated" sortBy={sortBy} sortDir={sortDir} onToggle={toggle} />
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns} className="px-3 py-6 text-center text-fg-muted">
                No items match the current filters.
              </td>
            </tr>
          )}
          {sorted.map((r) => (
            <tr key={r.obligationId} className="border-t border-border">
              <td className="px-3 py-2 font-medium text-fg">
                <Link
                  href={`/${slug}/${r.obligationId}`}
                  className="text-fg hover:text-primary hover:underline"
                >
                  {r.client.legalName}
                </Link>
              </td>
              <td className="px-3 py-2 text-fg">
                {filingTypeLabel(r.obligation.filingType, r.client.incorporationJurisdiction)}
              </td>
              {extraColumns.map((col) => (
                <td key={col} className="px-3 py-2 text-fg-muted">
                  {extraCell(col, r)}
                </td>
              ))}
              <td className="px-3 py-2 text-fg-muted">{formatUTC(dateOf(r, dateColumn))}</td>
              <td className="px-3 py-2 text-fg">
                <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-xs">{r.status}</span>
              </td>
              <td className="px-3 py-2 text-fg-muted">
                {r.updatedAt.getTime() > 0 ? formatUTC(r.updatedAt) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
