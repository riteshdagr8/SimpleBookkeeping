"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { workflowLinkForObligation } from "@/lib/workflows/route-map";
import { filingTypeLabel } from "@/lib/obligation-matrix";

export interface ObligationRow {
  id: string;
  filingType: string;
  periodStart: string | null;
  periodEnd: string | null;
  filingDueDate: string | null;
  paymentDueDate: string | null;
  status: string;
  workflowStatus: string | null;
  amount: number | null;
  dateFiled: string | null;
  confirmationNumber: string | null;
  notes: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  Pending: "bg-bg-subtle text-fg-muted",
  WaitingOnClient: "bg-warning/15 text-warning",
  InProgress: "bg-accent/15 text-accent",
  ReadyForReview: "bg-primary/15 text-primary",
  "Filed/Completed": "bg-success/15 text-success",
  Overdue: "bg-danger/15 text-danger",
};

function typeLabel(t: string, jurisdiction?: string | null): string {
  return filingTypeLabel(t, jurisdiction);
}

function isOverdue(due: string | null, status: string) {
  if (status === "Filed/Completed" || status === "Completed") return false;
  if (!due) return false;
  const d = new Date(due);
  return d.getTime() < Date.now();
}

function statusLabel(s: string): string {
  if (s === "WaitingOnClient") return "Waiting on Client";
  return s;
}

// Format a date string in UTC to avoid timezone-driven off-by-one-day display.
// Stored dates are midnight UTC; using local time shifts them back a day for
// users west of UTC.
function formatUTC(iso: string | null, withYear: boolean): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  };
  return new Intl.DateTimeFormat("en-US", opts).format(d);
}

export function ObligationTable({
  clientId,
  clientJurisdiction,
  rows,
}: {
  clientId: string;
  clientJurisdiction?: string | null;
  rows: ObligationRow[];
}) {
  const [navigating, setNavigating] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>("filingDue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filter, setFilter] = useState<string>("All");
  const typeOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.filingType));
    return [...set].sort((a, b) => typeLabel(a, clientJurisdiction).localeCompare(typeLabel(b, clientJurisdiction)));
  }, [rows, clientJurisdiction]);
  const filteredRows = useMemo(() => filter === "All" ? rows : rows.filter((r) => r.filingType === filter), [rows, filter]);

  const sorted = useMemo(() => {
    const dir = sortDir === "desc" ? -1 : 1;
    return [...filteredRows].sort((a, b) => {
      let cmp = 0;
      if (sortBy === "type") {
        cmp = typeLabel(a.filingType, clientJurisdiction).localeCompare(typeLabel(b.filingType, clientJurisdiction));
      } else if (sortBy === "period") {
        const ap = a.periodStart ? new Date(a.periodStart).getTime() : 0;
        const bp = b.periodStart ? new Date(b.periodStart).getTime() : 0;
        cmp = ap - bp;
      } else if (sortBy === "filingDue") {
        const ad = a.filingDueDate ? new Date(a.filingDueDate).getTime() : 0;
        const bd = b.filingDueDate ? new Date(b.filingDueDate).getTime() : 0;
        cmp = ad - bd;
      }
      return cmp * dir;
    });
  }, [filteredRows, sortBy, sortDir]);

  function toggleSort(field: string) {
    if (sortBy === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  function sortIndicator(field: string): string {
    if (sortBy !== field) return "";
    return sortDir === "asc" ? " ▲" : " ▼";
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-xs font-medium text-fg-muted">Filing type</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-md border border-border bg-surface px-2 py-1 text-sm text-fg"
        >
          <option value="All">All</option>
          {typeOptions.map((t) => (
            <option key={t} value={t}>{typeLabel(t, clientJurisdiction)}</option>
          ))}
        </select>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <table className="min-w-full text-sm">
        <thead className="bg-bg-subtle text-left text-xs text-fg-muted">
          <tr>
            <th className="px-3 py-2 font-medium cursor-pointer hover:text-fg" onClick={() => toggleSort("type")}>
              Type{sortIndicator("type")}
            </th>
            <th className="px-3 py-2 font-medium cursor-pointer hover:text-fg" onClick={() => toggleSort("period")}>
              Period{sortIndicator("period")}
            </th>
            <th className="px-3 py-2 font-medium cursor-pointer hover:text-fg" onClick={() => toggleSort("filingDue")}>
              Filing due{sortIndicator("filingDue")}
            </th>
            <th className="px-3 py-2 font-medium">Payment due</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-6 text-center text-fg-muted">
                No obligations yet. Use &quot;Generate schedule&quot; on the client page.
              </td>
            </tr>
          )}
          {sorted.map((r) => {
            const displayStatus = r.workflowStatus ?? r.status;
            const overdue = isOverdue(r.filingDueDate, displayStatus);
            return (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium text-fg">
                  {(() => {
                    const href = workflowLinkForObligation(r.filingType, r.id);
                    if (!href) return typeLabel(r.filingType, clientJurisdiction);
                    const linkHref = clientId ? `${href}?from=schedule&clientId=${clientId}` : href;
                    return (
                      <Link
                        href={linkHref}
                        onClick={() => setNavigating(r.id)}
                        className={`text-primary hover:underline ${navigating === r.id ? "opacity-50 pointer-events-none" : ""}`}
                      >
                        {navigating === r.id ? "Loading…" : typeLabel(r.filingType, clientJurisdiction)}
                      </Link>
                    );
                  })()}
                </td>
                <td className="px-3 py-2 text-fg-muted">
                  {r.periodStart && r.periodEnd
                    ? `${formatUTC(r.periodStart, true)} – ${formatUTC(r.periodEnd, true)}`
                    : "—"}
                </td>
                <td className={`px-3 py-2 ${overdue ? "text-danger font-medium" : "text-fg-muted"}`}>
                  {r.filingDueDate ? formatUTC(r.filingDueDate, true) : "—"}
                </td>
                <td className="px-3 py-2 text-fg-muted">
                  {r.paymentDueDate ? formatUTC(r.paymentDueDate, true) : "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                      STATUS_BADGE[displayStatus] ?? "bg-bg-subtle text-fg-muted"
                    }`}
                  >
                    {statusLabel(displayStatus)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
