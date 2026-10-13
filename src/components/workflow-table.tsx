"use client";

import Link from "next/link";
import { filingTypeLabel } from "@/lib/obligation-matrix";
import { SortableTh, useSort, type SortValue } from "@/components/sortable";
import type { ListedWorkflow } from "@/lib/workflows/service";

function formatUTC(d: Date | null): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

const ACCESSORS: Record<string, (r: ListedWorkflow) => SortValue> = {
  client: (r) => r.client.fileNumber ?? r.client.legalName,
  type: (r) => filingTypeLabel(r.obligation.filingType, r.client.incorporationJurisdiction),
  fye: (r) => r.client.fiscalYearEnd.getTime(),
  filingDue: (r) => r.obligation.filingDueDate?.getTime() ?? null,
  status: (r) => r.status,
  updated: (r) => r.updatedAt.getTime(),
};

export function WorkflowTable({
  rows,
  slug,
  showFye,
}: {
  rows: ListedWorkflow[];
  slug: string;
  showFye: boolean;
}) {
  const { sorted, sortBy, sortDir, toggle } = useSort(rows, "filingDue", ACCESSORS);
  const columns = showFye ? 6 : 5;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <table className="min-w-full text-sm">
        <thead className="bg-bg-subtle text-left text-xs text-fg-muted">
          <tr>
            <SortableTh label="Client" sortKey="client" sortBy={sortBy} sortDir={sortDir} onToggle={toggle} />
            <SortableTh label="Type" sortKey="type" sortBy={sortBy} sortDir={sortDir} onToggle={toggle} />
            {showFye && (
              <SortableTh label="Fiscal year end" sortKey="fye" sortBy={sortBy} sortDir={sortDir} onToggle={toggle} />
            )}
            <SortableTh label="Filing due" sortKey="filingDue" sortBy={sortBy} sortDir={sortDir} onToggle={toggle} />
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
                  {r.client.fileNumber ? `${r.client.fileNumber} — ` : ""}
                  {r.client.legalName}
                </Link>
              </td>
              <td className="px-3 py-2 text-fg">
                {filingTypeLabel(r.obligation.filingType, r.client.incorporationJurisdiction)}
              </td>
              {showFye && <td className="px-3 py-2 text-fg-muted">{formatUTC(r.client.fiscalYearEnd)}</td>}
              <td className="px-3 py-2 text-fg-muted">{formatUTC(r.obligation.filingDueDate)}</td>
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
