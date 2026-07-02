"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface Item {
  id: string;
  itemName: string;
  created: boolean;
}

export function FolderChecklist({ clientId, items }: { clientId: string; items: Item[] }) {
  const router = useRouter();
  const [local, setLocal] = useState(items);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function toggle(idx: number) {
    const next = local.map((it, i) => (i === idx ? { ...it, created: !it.created } : it));
    setLocal(next);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/checklist`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemName: next[idx].itemName, created: next[idx].created }),
      });
      if (!res.ok) throw new Error("Save failed");
      startTransition(() => router.refresh());
    } catch (e) {
      setLocal(items);
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-fg">Folder checklist</h2>
      <p className="mt-1 text-xs text-fg-muted">Confirm the local folders are created for this client.</p>
      <ul className="mt-3 space-y-2">
        {local.map((it, i) => (
          <li key={it.id} className="flex items-center gap-3">
            <input
              id={`chk-${it.id}`}
              type="checkbox"
              checked={it.created}
              onChange={() => toggle(i)}
              disabled={pending}
              className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
            />
            <label htmlFor={`chk-${it.id}`} className="text-sm text-fg">
              {it.itemName}
            </label>
          </li>
        ))}
      </ul>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
