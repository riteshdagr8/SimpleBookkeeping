"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const STATUSES = ["", "NotStarted", "WaitingOnClient", "InProgress", "ReadyForReview", "Filed", "Overdue"] as const;
const TYPES = ["", "T2", "HST", "PayrollRemittance", "OntarioAnnualReturn", "FederalAnnualReturn", "T4", "T4A", "T5"] as const;

export function DashboardFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function update(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`?${next.toString()}`));
  }

  return (
    <div className={`flex flex-wrap items-end gap-3 ${pending ? "opacity-60" : ""}`}>
      <div>
        <label className="block text-xs font-medium text-fg-muted">From</label>
        <input
          type="date"
          defaultValue={params.get("from") ?? ""}
          onChange={(e) => update("from", e.target.value)}
          className="mt-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-fg-muted">To</label>
        <input
          type="date"
          defaultValue={params.get("to") ?? ""}
          onChange={(e) => update("to", e.target.value)}
          className="mt-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-fg-muted">Status</label>
        <select
          defaultValue={params.get("status") ?? ""}
          onChange={(e) => update("status", e.target.value)}
          className="mt-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
        >
          {STATUSES.map((s) => (
            <option key={s || "all"} value={s}>
              {s || "All"}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-fg-muted">Filing type</label>
        <select
          defaultValue={params.get("filingType") ?? ""}
          onChange={(e) => update("filingType", e.target.value)}
          className="mt-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
        >
          {TYPES.map((t) => (
            <option key={t || "all"} value={t}>
              {t || "All"}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
