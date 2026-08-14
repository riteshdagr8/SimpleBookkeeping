"use client";
import { useState } from "react";
import Link from "next/link";
import { format } from "date-fns";

type Row = { id: string; filingType: string; filingDueDate: Date | null; status: string; client: { id: string; fileNumber: string | null; legalName: string } };
export function MonitoringFilters({ overdue, dueThisWeek, waiting }: { overdue: Row[]; dueThisWeek: Row[]; waiting: Row[] }) {
  const [filter, setFilter] = useState<"All" | "PayrollProcessing" | "PayrollRemittance">("All");
  const visible = (rows: Row[]) => filter === "All" ? rows : rows.filter((r) => r.filingType === filter);
  return <>
    <div className="inline-flex rounded-md border border-border bg-surface p-0.5" role="group" aria-label="Obligation type filter">
      {([["All", "All"], ["PayrollProcessing", "Payroll Processing"], ["PayrollRemittance", "Payroll Remittances"]] as const).map(([v, l]) => <button key={v} type="button" onClick={() => setFilter(v)} className={`rounded px-3 py-1 text-xs ${filter === v ? "bg-primary text-white" : "text-fg-muted"}`}>{l}</button>)}
    </div>
    <Section title="Overdue" rows={visible(overdue)} empty="Nothing overdue. Good." border="border-danger/30" />
    <Section title="Due this week" rows={visible(dueThisWeek)} empty="No deadlines in the next 7 days." border="border-border" />
    <Section title="Waiting on client" rows={visible(waiting)} empty="Nothing waiting on a client." border="border-warning/30" />
  </>;
}
function Section({ title, rows, empty, border }: { title: string; rows: Row[]; empty: string; border: string }) {
 return <section className={`rounded-lg border ${border} bg-surface p-4`}><h2 className="text-sm font-semibold text-fg">{title}</h2>{rows.length === 0 ? <p className="mt-2 text-sm text-fg-muted">{empty}</p> : <ul className="mt-3 divide-y divide-border">{rows.map((o) => <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm"><div><Link href={`/clients/${o.client.id}`} className="font-medium text-fg hover:underline">{o.client.fileNumber ? `${o.client.fileNumber} — ` : ""}{o.client.legalName}</Link><span className="ml-3 text-fg-muted">{o.filingType}</span></div><div className="flex items-center gap-3"><span className="text-fg-muted">{o.filingDueDate ? format(new Date(o.filingDueDate), "MMM d, yyyy") : "—"}</span><span className="rounded-full bg-bg-subtle px-2 py-0.5 text-xs text-fg-muted">{o.status}</span></div></li>)}</ul>}</section>;
}
