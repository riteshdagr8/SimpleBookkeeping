"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { JURISDICTIONS } from "@/lib/jurisdictions";
import { PAY_FREQUENCIES } from "@/lib/payroll-frequency";

interface Props {
  /** The full list of valid workflow statuses for this workflow. */
  statuses: string[];
  /** Slug for the route, used to build the page link. */
  slug: string;
  /** Distinct provinces/territories to filter by (e.g. Provincial AR page). */
  provinces?: string[];
  /** Income Taxes: filter by the client's fiscal year-end month. */
  showFyeMonth?: boolean;
  /** Sales Tax: filter by the client's GST/HST filing frequency. */
  showFrequency?: boolean;
  /** Payroll Processing: filter by pay frequency. */
  showPayFrequency?: boolean;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Same values and labels as the GST/HST frequency field on the client form. */
const FREQUENCY_OPTIONS: Array<[value: string, label: string]> = [
  ["Monthly", "Monthly"],
  ["Quarterly", "Quarterly"],
  ["Annual", "Annual"],
  ["SelfEmployed", "Annual (Self-employed)"],
];

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function presetRange(preset: "this" | "last3" | "next" | "next3"): { from: string; to: string } {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  if (preset === "this") {
    return { from: toIsoDate(new Date(Date.UTC(y, m, 1))), to: toIsoDate(new Date(Date.UTC(y, m + 1, 0))) };
  }
  if (preset === "next") {
    return { from: toIsoDate(new Date(Date.UTC(y, m + 1, 1))), to: toIsoDate(new Date(Date.UTC(y, m + 2, 0))) };
  }
  if (preset === "next3") {
    return { from: toIsoDate(new Date(Date.UTC(y, m + 1, 1))), to: toIsoDate(new Date(Date.UTC(y, m + 4, 0))) };
  }
  // last3
  return { from: toIsoDate(new Date(Date.UTC(y, m - 2, 1))), to: toIsoDate(new Date(Date.UTC(y, m + 1, 0))) };
}

function provinceLabel(code: string): string {
  return JURISDICTIONS.find((j) => j.code === code)?.label ?? code;
}

/** Pause after the last keystroke before the list is re-queried. */
const CLIENT_SEARCH_DEBOUNCE_MS = 300;

export function WorkflowFilters({
  statuses,
  slug,
  provinces,
  showFyeMonth,
  showFrequency,
  showPayFrequency,
}: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  // The client name box is typed into locally and written to the URL after a
  // short pause, so the list doesn't re-query on every keystroke.
  const urlClient = params.get("client") ?? "";
  const [clientText, setClientText] = useState(urlClient);

  // Follow the URL when it changes from elsewhere (Clear, back/forward).
  useEffect(() => {
    setClientText(urlClient);
  }, [urlClient]);

  useEffect(() => {
    const wanted = clientText.trim();
    if (wanted === urlClient.trim()) return;
    const t = setTimeout(() => update("client", wanted), CLIENT_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // update() only reads router/params, which are re-created on navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientText, urlClient]);

  function updateAll(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    startTransition(() => router.replace(`?${next.toString()}`));
  }

  function update(key: string, value: string) {
    updateAll({ [key]: value || null });
  }

  function clear() {
    const next = new URLSearchParams();
    setClientText("");
    startTransition(() => router.replace(`?${next.toString()}`));
  }

  return (
    <div className={`space-y-3 ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-end gap-3">
        {provinces && provinces.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-fg-muted">Province</label>
            <select
              key={params.get("province") ?? "all"}
              defaultValue={params.get("province") ?? "all"}
              onChange={(e) => update("province", e.target.value === "all" ? "" : e.target.value)}
              className="mt-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
            >
              <option value="all">All</option>
              {provinces.map((p) => (
                <option key={p} value={p}>{provinceLabel(p)}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-fg-muted">Client</label>
          <input
            type="search"
            value={clientText}
            onChange={(e) => setClientText(e.target.value)}
            placeholder="Search by name"
            className="mt-1 w-56 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg placeholder:text-fg-muted/70"
          />
        </div>
        {showFyeMonth && (
          <div>
            <label className="block text-xs font-medium text-fg-muted">Fiscal year end</label>
            <select
              key={params.get("fyeMonth") ?? "all"}
              defaultValue={params.get("fyeMonth") ?? "all"}
              onChange={(e) => update("fyeMonth", e.target.value === "all" ? "" : e.target.value)}
              className="mt-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
            >
              <option value="all">All months</option>
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={String(i + 1)}>{name}</option>
              ))}
            </select>
          </div>
        )}
        {showPayFrequency && (
          <div>
            <label className="block text-xs font-medium text-fg-muted">Pay frequency</label>
            <select
              key={params.get("payFrequency") ?? "all"}
              defaultValue={params.get("payFrequency") ?? "all"}
              onChange={(e) => update("payFrequency", e.target.value === "all" ? "" : e.target.value)}
              className="mt-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
            >
              <option value="all">All</option>
              {PAY_FREQUENCIES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        )}
        {showFrequency && (
          <div>
            <label className="block text-xs font-medium text-fg-muted">Frequency</label>
            <select
              key={params.get("frequency") ?? "all"}
              defaultValue={params.get("frequency") ?? "all"}
              onChange={(e) => update("frequency", e.target.value === "all" ? "" : e.target.value)}
              className="mt-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
            >
              <option value="all">All</option>
              {FREQUENCY_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-xs font-medium text-fg-muted">From</label>
          <input
            type="date"
            key={params.get("from") ?? ""}
            defaultValue={params.get("from") ?? ""}
            onChange={(e) => update("from", e.target.value)}
            className="mt-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted">To</label>
          <input
            type="date"
            key={params.get("to") ?? ""}
            defaultValue={params.get("to") ?? ""}
            onChange={(e) => update("to", e.target.value)}
            className="mt-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-fg-muted">Status</label>
          <select
            key={params.get("status") ?? "Pending"}
            defaultValue={params.get("status") ?? "Pending"}
            onChange={(e) => update("status", e.target.value)}
            className="mt-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
          >
            <option value="all">All</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{s}</option>
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
            ["This month", "this"],
            ["Last 3 months", "last3"],
            ["Next month", "next"],
            ["Next 3 months", "next3"],
          ] as const
        ).map(([label, key]) => (
          <button
            key={key}
            type="button"
            onClick={() => updateAll(presetRange(key))}
            className="rounded-md border border-border bg-surface px-2.5 py-1 text-xs text-fg hover:bg-bg-subtle"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
