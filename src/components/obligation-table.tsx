"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { OBLIGATION_STATUS_VALUES } from "@/lib/services/obligations";

export interface ObligationRow {
  id: string;
  filingType: string;
  periodStart: string | null;
  periodEnd: string | null;
  filingDueDate: string | null;
  paymentDueDate: string | null;
  status: string;
  amount: number | null;
  dateFiled: string | null;
  confirmationNumber: string | null;
  notes: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  NotStarted: "bg-bg-subtle text-fg-muted",
  WaitingOnClient: "bg-warning/15 text-warning",
  InProgress: "bg-accent/15 text-accent",
  ReadyForReview: "bg-primary/15 text-primary",
  Filed: "bg-success/15 text-success",
  Overdue: "bg-danger/15 text-danger",
};

function isOverdue(due: string | null, status: string) {
  if (status === "Filed") return false;
  if (!due) return false;
  const d = new Date(due);
  return d.getTime() < Date.now();
}

export function ObligationTable({ clientId, rows }: { clientId: string; rows: ObligationRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState(rows);

  async function patch(id: string, body: Record<string, unknown>) {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/obligations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Save failed");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  }

  function setField<K extends keyof ObligationRow>(id: string, key: K, value: ObligationRow[K]) {
    setLocal((rows) => rows.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <table className="min-w-full text-sm">
        <thead className="bg-bg-subtle text-left text-xs text-fg-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Period</th>
            <th className="px-3 py-2 font-medium">Filing due</th>
            <th className="px-3 py-2 font-medium">Payment due</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Amount</th>
            <th className="px-3 py-2 font-medium">Date filed</th>
            <th className="px-3 py-2 font-medium">Confirmation</th>
          </tr>
        </thead>
        <tbody>
          {local.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-6 text-center text-fg-muted">
                No obligations yet. Use &quot;Generate schedule&quot; on the client page.
              </td>
            </tr>
          )}
          {local.map((r) => {
            const overdue = isOverdue(r.filingDueDate, r.status);
            return (
              <tr key={r.id} className="border-t border-border">
                <td className="px-3 py-2 font-medium text-fg">{r.filingType}</td>
                <td className="px-3 py-2 text-fg-muted">
                  {r.periodStart && r.periodEnd
                    ? `${format(new Date(r.periodStart), "MMM d")} – ${format(new Date(r.periodEnd), "MMM d")}`
                    : "—"}
                </td>
                <td className={`px-3 py-2 ${overdue ? "text-danger font-medium" : "text-fg-muted"}`}>
                  {r.filingDueDate ? format(new Date(r.filingDueDate), "MMM d, yyyy") : "—"}
                </td>
                <td className="px-3 py-2 text-fg-muted">
                  {r.paymentDueDate ? format(new Date(r.paymentDueDate), "MMM d, yyyy") : "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`mr-2 inline-block rounded-full px-2 py-0.5 text-xs ${
                      STATUS_BADGE[r.status] ?? "bg-bg-subtle text-fg-muted"
                    }`}
                  >
                    {r.status}
                  </span>
                  <select
                    value={r.status}
                    disabled={pending && savingId === r.id}
                    onChange={(e) => {
                      setField(r.id, "status", e.target.value);
                      patch(r.id, { status: e.target.value });
                    }}
                    className="rounded-md border border-border bg-bg-subtle px-2 py-1 text-xs text-fg focus:border-ring focus:ring-2 focus:ring-ring/30"
                  >
                    {OBLIGATION_STATUS_VALUES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    step="0.01"
                    value={r.amount ?? ""}
                    disabled={pending && savingId === r.id}
                    onChange={(e) =>
                      setField(r.id, "amount", e.target.value === "" ? null : Number(e.target.value))
                    }
                    onBlur={(e) =>
                      patch(r.id, { amount: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    className="w-24 rounded-md border border-border bg-bg-subtle px-2 py-1 text-xs text-fg"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="date"
                    value={r.dateFiled ? r.dateFiled.slice(0, 10) : ""}
                    disabled={pending && savingId === r.id}
                    onChange={(e) => {
                      const v = e.target.value || null;
                      setField(r.id, "dateFiled", v);
                      patch(r.id, { dateFiled: v });
                    }}
                    className="rounded-md border border-border bg-bg-subtle px-2 py-1 text-xs text-fg"
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={r.confirmationNumber ?? ""}
                    disabled={pending && savingId === r.id}
                    onChange={(e) => setField(r.id, "confirmationNumber", e.target.value || null)}
                    onBlur={(e) => patch(r.id, { confirmationNumber: e.target.value || null })}
                    className="w-32 rounded-md border border-border bg-bg-subtle px-2 py-1 text-xs text-fg"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {error && <p className="px-3 py-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
