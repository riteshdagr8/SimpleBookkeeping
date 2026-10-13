"use client";

import { useEffect } from "react";

interface InfoDialogProps {
  open: boolean;
  title: string;
  message?: string;
  closeLabel?: string;
  onClose: () => void;
}

/** Single-button acknowledgement dialog (no cancel/confirm pair). */
export function InfoDialog({
  open,
  title,
  message,
  closeLabel = "Close",
  onClose,
}: InfoDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold text-fg">{title}</h2>
        {message && <p className="mt-2 text-sm text-fg-muted">{message}</p>}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90"
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
