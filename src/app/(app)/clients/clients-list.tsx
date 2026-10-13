"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SortableTh, useSort, type SortValue } from "@/components/sortable";

export interface ClientRow {
  id: string;
  fileNumber: string | null;
  legalName: string;
  businessNumber: string | null;
  fiscalYearEnd: string;
  reviewComplete: boolean;
  onboardingStatus: string;
  active: boolean;
}

interface Props {
  clients: ClientRow[];
  userRole: "Admin" | "Staff";
}

type Pending = {
  action: "inactivate" | "reactivate";
  clientId: string;
  clientName: string;
} | null;

type ClientFilter = "active" | "inactive" | "all";

const ACCESSORS: Record<string, (c: ClientRow) => SortValue> = {
  fileNumber: (c) => c.fileNumber ?? null,
  legalName: (c) => c.legalName,
  businessNumber: (c) => c.businessNumber ?? null,
  fiscalYearEnd: (c) => new Date(c.fiscalYearEnd).getTime(),
  review: (c) => (!c.active ? -1 : c.reviewComplete ? 1 : 0),
  status: (c) => (!c.active ? "Inactive" : c.onboardingStatus),
};

function formatUTC(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function ClientsList({ clients, userRole }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const statusParam = params.get("status");
  const filter: ClientFilter =
    statusParam === "inactive" ? "inactive" : statusParam === "all" ? "all" : "active";
  const visible =
    filter === "all"
      ? clients
      : filter === "inactive"
        ? clients.filter((c) => !c.active)
        : clients.filter((c) => c.active);

  const { sorted, sortBy, sortDir, toggle } = useSort(visible, "fileNumber", ACCESSORS);

  function setFilter(next: ClientFilter) {
    const qs = new URLSearchParams(params.toString());
    if (next === "active") qs.delete("status");
    else qs.set("status", next);
    startTransition(() => router.replace(`?${qs.toString()}`));
  }

  async function performAction() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      const url =
        target.action === "inactivate"
          ? `/api/clients/${target.clientId}`
          : `/api/clients/${target.clientId}/reactivate`;
      const method = target.action === "inactivate" ? "DELETE" : "POST";
      const res = await fetch(url, { method });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Request failed");
      }
      setTarget(null);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <label className="block text-xs font-medium text-fg-muted">
          Show
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ClientFilter)}
            className="mt-1 block rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg"
          >
            <option value="active">Active Clients</option>
            <option value="inactive">Inactive Clients</option>
            <option value="all">All Clients</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="min-w-full text-sm">
          <thead className="bg-bg-subtle text-left text-xs text-fg-muted">
            <tr>
              <SortableTh label="File #" sortKey="fileNumber" sortBy={sortBy} sortDir={sortDir} onToggle={toggle} className="px-4 py-2 font-medium" />
              <SortableTh label="Legal name" sortKey="legalName" sortBy={sortBy} sortDir={sortDir} onToggle={toggle} className="px-4 py-2 font-medium" />
              <SortableTh label="BN" sortKey="businessNumber" sortBy={sortBy} sortDir={sortDir} onToggle={toggle} className="px-4 py-2 font-medium" />
              <SortableTh label="FYE" sortKey="fiscalYearEnd" sortBy={sortBy} sortDir={sortDir} onToggle={toggle} className="px-4 py-2 font-medium" />
              <SortableTh label="Review" sortKey="review" sortBy={sortBy} sortDir={sortDir} onToggle={toggle} className="px-4 py-2 font-medium" />
              <SortableTh label="Status" sortKey="status" sortBy={sortBy} sortDir={sortDir} onToggle={toggle} className="px-4 py-2 font-medium" />
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-fg-muted">
                  {clients.length === 0 ? (
                    <>
                      No clients yet.{" "}
                      <Link href="/clients/new" className="text-primary hover:underline">
                        Create the first one
                      </Link>
                      .
                    </>
                  ) : filter === "inactive" ? (
                    <>No inactive clients.</>
                  ) : filter === "all" ? (
                    <>No clients.</>
                  ) : (
                    <>No active clients. Choose &quot;All Clients&quot; to see inactive ones.</>
                  )}
                </td>
              </tr>
            )}
            {sorted.map((c) => {
              const isInactive = !c.active;
              return (
                <tr
                  key={c.id}
                  className={`border-t border-border ${isInactive ? "bg-bg-subtle/40 text-fg-muted" : ""}`}
                >
                  <td className="px-4 py-2 font-medium text-fg">
                    <Link href={`/clients/${c.id}`} className="text-fg hover:text-primary hover:underline">
                      {c.fileNumber || "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-fg">
                    <Link href={`/clients/${c.id}`} className="text-fg hover:text-primary hover:underline">
                      {c.legalName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-fg-muted">{c.businessNumber ?? "—"}</td>
                  <td className="px-4 py-2 text-fg-muted">
                    {formatUTC(c.fiscalYearEnd)}
                  </td>
                  <td className="px-4 py-2">
                    {isInactive ? (
                      <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-xs text-fg-muted">—</span>
                    ) : c.reviewComplete ? (
                      <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
                        Complete
                      </span>
                    ) : (
                      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {isInactive ? (
                      <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-xs text-fg-muted">
                        Inactive
                      </span>
                    ) : (
                      <span className="text-fg-muted">{c.onboardingStatus}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {userRole === "Admin" && !isInactive && (
                        <button
                          type="button"
                          onClick={() =>
                            setTarget({
                              action: "inactivate",
                              clientId: c.id,
                              clientName: c.legalName,
                            })
                          }
                          disabled={pending}
                          className="text-xs text-fg-muted hover:text-danger disabled:opacity-50"
                        >
                          Inactivate
                        </button>
                      )}
                      {userRole === "Admin" && isInactive && (
                        <button
                          type="button"
                          onClick={() =>
                            setTarget({
                              action: "reactivate",
                              clientId: c.id,
                              clientName: c.legalName,
                            })
                          }
                          disabled={pending}
                          className="text-xs text-primary hover:underline disabled:opacity-50"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}

      <ConfirmDialog
        open={target !== null}
        title={target?.action === "inactivate" ? "Inactivate client?" : "Reactivate client?"}
        message={
          target?.action === "inactivate"
            ? `${target.clientName} will be hidden from the dashboard and monitoring. Staff will not be able to view or edit. You can reactivate later.`
            : `${target?.clientName} will become active again and reappear on the dashboard.`
        }
        confirmLabel={target?.action === "inactivate" ? "Inactivate" : "Reactivate"}
        cancelLabel="Cancel"
        tone={target?.action === "inactivate" ? "danger" : "default"}
        loading={busy}
        onConfirm={performAction}
        onCancel={() => {
          if (!busy) setTarget(null);
        }}
      />
    </div>
  );
}
