"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";

export interface ClientRow {
  id: string;
  fileNumber: string | null;
  legalName: string;
  businessNumber: string | null;
  phone: string | null;
  primaryEmail: string;
  secondaryEmail: string | null;
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

  const showInactive = params.get("showInactive") === "1";
  const visible = showInactive ? clients : clients.filter((c) => c.active);
  const hiddenCount = clients.length - visible.length;

  function toggleShowInactive() {
    const next = new URLSearchParams(params.toString());
    if (showInactive) next.delete("showInactive");
    else next.set("showInactive", "1");
    startTransition(() => router.replace(`?${next.toString()}`));
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
        <label className="inline-flex items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={toggleShowInactive}
            className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
          />
          Show inactive clients
        </label>
        {hiddenCount > 0 && (
          <span className="text-xs text-fg-muted">
            ({hiddenCount} hidden)
          </span>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="min-w-full text-sm">
          <thead className="bg-bg-subtle text-left text-xs text-fg-muted">
            <tr>
              <th className="px-4 py-2 font-medium">File #</th>
              <th className="px-4 py-2 font-medium">Legal name</th>
              <th className="px-4 py-2 font-medium">BN</th>
              <th className="px-4 py-2 font-medium">FYE</th>
              <th className="px-4 py-2 font-medium">Review</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 && (
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
                  ) : (
                    <>No active clients. Toggle &quot;Show inactive&quot; to see them.</>
                  )}
                </td>
              </tr>
            )}
            {visible.map((c) => {
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
                    {(c.primaryEmail || c.secondaryEmail) && (
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-fg-muted">
                        {c.primaryEmail && <span>{c.primaryEmail}</span>}
                        {c.primaryEmail && c.secondaryEmail && (
                          <span className="text-fg-muted/50">·</span>
                        )}
                        {c.secondaryEmail && <span>{c.secondaryEmail}</span>}
                      </div>
                    )}
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
                    <div className="flex items-center gap-3">
                      {isInactive ? (
                        <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-xs text-fg-muted">
                          Inactive
                        </span>
                      ) : (
                        <span className="text-fg-muted">{c.onboardingStatus}</span>
                      )}
                      {c.phone && <span className="text-xs text-fg-muted">{c.phone}</span>}
                    </div>
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
