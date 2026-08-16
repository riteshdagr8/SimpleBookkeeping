"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { JURISDICTIONS } from "@/lib/jurisdictions";

interface ClientOption {
  id: string;
  fileNumber: string | null;
  legalName: string;
}

interface Props {
  clients: ClientOption[];
  /** The full list of valid workflow statuses for this workflow. */
  statuses: string[];
  /** Slug for the route, used to build the page link. */
  slug: string;
  /** Distinct provinces/territories to filter by (e.g. Provincial AR page). */
  provinces?: string[];
}

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

export function WorkflowFilters({ clients, statuses, slug, provinces }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

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
          <select
            defaultValue={params.get("clientId") ?? ""}
            onChange={(e) => update("clientId", e.target.value)}
            className="mt-1 rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
          >
            <option value="">All</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fileNumber ? `${c.fileNumber} — ` : ""}
                {c.legalName}
              </option>
            ))}
          </select>
        </div>
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
