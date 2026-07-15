"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoadingButton } from "@/components/loading-button";
import type { ChecklistState, WorkflowField } from "@/lib/workflows/types";

export interface EditorStep {
  key: string;
  label: string;
  comment: string;
}

export interface EditorConfig {
  slug: string;
  displayName: string;
  shortName: string;
  allowsClientInteraction: boolean;
  fields: WorkflowField[];
}

export interface WorkflowEditorProps {
  config: EditorConfig;
  visibleSteps: EditorStep[];
  obligationId: string;
  initial: {
    id: string;
    status: string;
    checklist: ChecklistState;
    fields: Record<string, string | number | null>;
  };
  /** Whether the client is QBO-Payroll — only used to display the badge;
   *  the conditional step is already filtered server-side. */
  client: {
    qbOnlinePayroll?: boolean;
    [k: string]: unknown;
  };
  /** True if there is an open "Waiting on client" interaction. */
  hasActiveInteraction: boolean;
  /** Active interaction note, if any. */
  interactionNote: string;
}

export function WorkflowEditor({
  config,
  visibleSteps,
  obligationId,
  initial,
  client,
  hasActiveInteraction: initialHasInteraction,
  interactionNote: initialNote,
}: WorkflowEditorProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [checklist, setChecklist] = useState<ChecklistState>(initial.checklist);
  const [fields, setFields] = useState<Record<string, string | number | null>>({
    ...Object.fromEntries(config.fields.map((f) => [f.key, initial.fields[f.key] ?? null])),
  });
  const [waitingOnClient, setWaitingOnClient] = useState<boolean>(initialHasInteraction);
  const [interactionNote, setInteractionNote] = useState<string>(initialNote);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/${config.slug}/${obligationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  function validateFilingDate(): boolean {
    // If the workflow has a filingDate field and the last visible step is
    // checked (meaning we're trying to complete the workflow), validate.
    const hasFilingDate = config.fields.some((f) => f.key === "filingDate");
    if (!hasFilingDate) return true;
    const lastStepKey = visibleSteps.length > 0 ? visibleSteps[visibleSteps.length - 1].key : null;
    if (!lastStepKey || !checklist[lastStepKey]) return true;

    const v = fields.filingDate;
    if (!v || v === "") {
      setError("Please enter a filing date before completing this workflow.");
      return false;
    }
    const d = new Date(String(v));
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (d.getTime() > today.getTime()) {
      setError("Filing date cannot be in the future.");
      return false;
    }
    return true;
  }

  function validatePayrollFields(): boolean {
    if (config.slug !== "payroll") return true;
    // If the last visible step is being checked, validate fields.
    const lastStepKey = visibleSteps.length > 0 ? visibleSteps[visibleSteps.length - 1].key : null;
    if (!lastStepKey || !checklist[lastStepKey]) return true;

    const empCount = fields.employeeCount;
    const totalRemit = fields.totalRemittance;
    if (empCount === null || empCount === "" || empCount === undefined) {
      setError("Please enter the number of employees before completing this workflow.");
      return false;
    }
    if (totalRemit === null || totalRemit === "" || totalRemit === undefined) {
      setError("Please enter the total remittance before completing this workflow.");
      return false;
    }
    return true;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-surface p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-fg">{config.displayName}</h2>
            <p className="mt-1 text-xs text-fg-muted">
              Status: <span className="font-medium text-fg">{initial.status}</span>
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {visibleSteps.map((step, idx) => (
            <div key={step.key} className="space-y-1">
              <label className="flex items-start gap-2 text-sm text-fg">
                <input
                  type="checkbox"
                  checked={!!checklist[step.key]}
                  onChange={(e) =>
                    setChecklist((c) => {
                      const next = { ...c, [step.key]: e.target.checked };
                      // Auto-check all prior steps in the sequence.
                      if (e.target.checked) {
                        for (let i = 0; i < idx; i++) {
                          next[visibleSteps[i].key] = true;
                        }
                      }
                      return next;
                    })
                  }
                  className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-ring"
                />
                <span className="font-medium">{step.label}</span>
              </label>
              <p className="ml-6 text-xs text-fg-muted">{step.comment}</p>
            </div>
          ))}
        </div>
        {config.slug === "payroll" && (client as { qbOnlinePayroll?: boolean }).qbOnlinePayroll === true && (
          <p className="mt-2 text-xs text-fg-muted">
            This client uses QuickBooks Online Payroll — the &ldquo;Remittances submitted&rdquo; step is shown.
          </p>
        )}

        {config.fields.length > 0 && (
          <div className="mt-5 space-y-3 border-t border-border pt-4">
            {config.fields.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-fg">{f.label}</label>
                <input
                  type={f.type === "date" ? "date" : f.type === "number" ? "number" : "text"}
                  inputMode={f.type === "number" ? "decimal" : undefined}
                  step={f.type === "number" ? "0.01" : undefined}
                  value={(() => {
                    const v = fields[f.key];
                    if (v === null || v === undefined) return "";
                    if (f.type === "date" && typeof v === "string") return v.slice(0, 10);
                    return String(v);
                  })()}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const next =
                      f.type === "number" ? (raw === "" ? null : Number(raw)) : raw === "" ? null : raw;
                    setFields((s) => ({ ...s, [f.key]: next }));
                  }}
                  className="mt-1 block w-full max-w-md rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-fg outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                />
              </div>
            ))}
          </div>
        )}

        {config.allowsClientInteraction && (
          <div className="mt-5 space-y-3 border-t border-border pt-4">
            <label className="flex items-start gap-2 text-sm text-fg">
              <input
                type="checkbox"
                checked={waitingOnClient}
                onChange={(e) => setWaitingOnClient(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-ring"
              />
              <span className="font-medium">Waiting on client</span>
            </label>
            <div className="ml-6">
              <textarea
                value={interactionNote}
                onChange={(e) => setInteractionNote(e.target.value)}
                rows={2}
                placeholder="Note (what is pending?)"
                className="block w-full max-w-md rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm text-fg outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
              {initialHasInteraction && (
                <p className="mt-2 text-xs text-fg-muted">
                  Open interaction — click Update to record the note, or check the Received box after the client responds.
                </p>
              )}
            </div>
            {initialHasInteraction && (
              <div className="ml-6">
                <LoadingButton
                  type="button"
                  variant="secondary"
                  loading={busy || pending}
                  onClick={async () => {
                    setBusy(true);
                    setError(null);
                    try {
                      // Uncheck waiting on client locally.
                      setWaitingOnClient(false);
                      // Close the interaction on the server.
                      const res = await fetch(`/api/${config.slug}/${obligationId}/interaction/close`, {
                        method: "POST",
                      });
                      if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data.error ?? "Close failed");
                      }
                      // Re-derive status by patching with waitingOnClient: false.
                      await patch({
                        checklist,
                        fields,
                        waitingOnClient: false,
                        interactionNote,
                      });
                      startTransition(() => router.refresh());
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Close failed");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Received (close interaction)
                </LoadingButton>
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-3">
          {error && <p className="text-xs text-danger">{error}</p>}
          <LoadingButton
            type="button"
            loading={busy || pending}
            onClick={() => {
              if (!validateFilingDate()) return;
              if (!validatePayrollFields()) return;
              patch({
                checklist,
                fields,
                waitingOnClient,
                interactionNote,
              })
            }}
          >
            Update
          </LoadingButton>
        </div>
      </div>
    </div>
  );
}