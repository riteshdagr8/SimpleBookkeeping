"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

export function ScheduleActions({
  clientId,
  reviewComplete,
}: {
  clientId: string;
  reviewComplete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[] | null>(null);

  async function generate() {
    setError(null);
    setWarnings(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/clients/${clientId}/schedule`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "Generate failed");
      }
      if (data.warnings?.length > 0) {
        setWarnings(data.warnings);
      }
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 items-end">
      {warnings && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning max-w-md">
          {warnings.map((w, i) => (
            <p key={i}>{w}</p>
          ))}
        </div>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
      <button
        type="button"
        onClick={generate}
        disabled={!reviewComplete || busy || pending}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50"
        title={!reviewComplete ? "Mark the historical review complete first" : "Replace existing schedule with fresh dates"}
      >
        <Sparkles className="h-4 w-4" />
        {busy ? "Generating..." : "Generate schedule"}
      </button>
    </div>
  );
}
