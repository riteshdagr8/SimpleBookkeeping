"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const STATUSES = ["", "Pending", "InProgress", "Completed", "WaitingOnClient"] as const;

const STATUS_LABELS: Record<string, string> = {
  Pending: "Pending",
  InProgress: "In Progress",
  Completed: "Completed",
  WaitingOnClient: "Waiting on Client",
};

const TYPES = ["", "T2", "HST", "PayrollRemittance", "OntarioAnnualReturn", "FederalAnnualReturn", "T4", "T4A", "T5"] as const;

const TYPE_LABELS: Record<string, string> = {
  T2: "Corporate Tax Return",
  HST: "GST/HST",
  PayrollRemittance: "Payroll Remittance",
  OntarioAnnualReturn: "Ontario Annual Return",
  FederalAnnualReturn: "Federal Annual Return",
  T4: "T4",
  T4A: "T4A",
  T5: "T5",
};

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetRange(preset: "current" | "last" | "last3" | "next3"): { from: string; to: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (preset === "current") {
    const first = new Date(Date.UTC(y, m, 1));
    const last = new Date(Date.UTC(y, m + 1, 0));
    return { from: toIsoDate(first), to: toIsoDate(last) };
  }
  if (preset === "last") {
    const first = new Date(Date.UTC(y, m - 1, 1));
    const last = new Date(Date.UTC(y, m, 0));
    return { from: toIsoDate(first), to: toIsoDate(last) };
  }
  if (preset === "last3") {
    const first = new Date(Date.UTC(y, m - 2, 1));
    const last = new Date(Date.UTC(y, m + 1, 0));
    return { from: toIsoDate(first), to: toIsoDate(last) };
  }
  // next3
  const first = new Date(Date.UTC(y, m + 1, 1));
  const last = new Date(Date.UTC(y, m + 4, 0));
  return { from: toIsoDate(first), to: toIsoDate(last) };
}

export function DashboardFilters() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function updateAll(updates: Record<string, string | null>) {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
    }
    startTransition(() => router.replace(`?${next.toString()}`));
  }

  function update(key: string, value: string) {
    // Preserve existing params when changing a single field.
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`?${next.toString()}`));
  }

  function clear() {
    startTransition(() => router.replace(`?`));
  }

  return (
    <div className={`space-y-3 ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-fg-muted">From</label>
          <input
            type="date"
            key={params.get("from") ?? "empty"}
            defaultValue={params.get("from") ?? ""}
            onChange={(e) => update("from", e.target.value)}
            className="mt-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted">To</label>
          <input
            type="date"
            key={params.get("to") ?? "empty"}
            defaultValue={params.get("to") ?? ""}
            onChange={(e) => update("to", e.target.value)}
            className="mt-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted">Status</label>
          <select
            key={params.get("status") ?? "empty"}
            defaultValue={params.get("status") ?? ""}
            onChange={(e) => update("status", e.target.value)}
            className="mt-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
          >
            {STATUSES.map((s) => (
              <option key={s || "all"} value={s}>
                {s ? (STATUS_LABELS[s] ?? s) : "All"}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted">Filing type</label>
          <select
            key={params.get("filingType") ?? "empty"}
            defaultValue={params.get("filingType") ?? ""}
            onChange={(e) => update("filingType", e.target.value)}
            className="mt-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
          >
            {TYPES.map((t) => (
              <option key={t || "all"} value={t}>
                {t ? (TYPE_LABELS[t] ?? t) : "All"}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={clear}
          className="rounded-md border border-border bg-bg-subtle px-3 py-1.5 text-sm text-fg hover:bg-surface"
        >
          Clear
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-fg-muted">Quick range:</span>
        {(
          [
            ["Current month", "current"],
            ["Last month", "last"],
            ["Last 3 months", "last3"],
            ["Next 3 months", "next3"],
          ] as const
        ).map(([label, key]) => (
          <button
            key={key}
            type="button"
            onClick={() => updateAll({ ...presetRange(key), status: null, filingType: null })}
            className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-fg hover:bg-bg-subtle"
          >
            {label}
          </button>
        ))}
        <span className="text-xs text-fg-muted">— Date range filters on filing due date. Overdue items with past due dates won&apos;t appear in a future-dated range; clear the filter to see all.</span>
      </div>
    </div>
  );
}