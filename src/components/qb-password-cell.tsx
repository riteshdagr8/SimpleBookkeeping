"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Eye, EyeOff, Check } from "lucide-react";

interface Props {
  clientId: string;
  /** Whether the cell has a password stored at all (controls visibility of the Reveal button). */
  hasPassword: boolean;
}

const AUTO_HIDE_MS = 20_000;

export function QbPasswordCell({ clientId, hasPassword }: Props) {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function clearReveal() {
    setRevealed(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  async function reveal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/me/qb-secret/${clientId}`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to reveal");
      }
      const data = (await res.json()) as { password: string };
      setRevealed(data.password);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => clearReveal(), AUTO_HIDE_MS);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reveal");
    } finally {
      setLoading(false);
    }
  }

  async function copy() {
    if (!revealed) return;
    try {
      await navigator.clipboard.writeText(revealed);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed");
    }
  }

  if (!hasPassword) {
    return <span className="text-fg-muted text-sm">—</span>;
  }

  return (
    <div className="inline-flex items-center gap-2">
      {revealed === null ? (
        <>
          <span aria-hidden className="select-none font-mono text-fg-muted">
            ••••••••
          </span>
          <button
            type="button"
            onClick={reveal}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg hover:bg-bg-subtle disabled:opacity-50"
            title="Reveal password"
          >
            <Eye className="h-3 w-3" />
            Reveal
          </button>
        </>
      ) : (
        <>
          <span className="font-mono text-fg">{revealed}</span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg hover:bg-bg-subtle"
            title="Copy password to clipboard"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
          <button
            type="button"
            onClick={clearReveal}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg hover:bg-bg-subtle"
            title="Hide password"
          >
            <EyeOff className="h-3 w-3" />
            Hide
          </button>
          <span className="text-xs text-fg-muted">auto-hides in 20s</span>
        </>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}
