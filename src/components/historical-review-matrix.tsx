"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { REVIEW_STATUSES, REVIEW_STATUS_LABELS, type ReviewStatus } from "@/lib/review-status";
import { REVIEW_GROUPS, REVIEW_GROUP_LABELS, type ReviewGroup } from "@/lib/review-groups";

interface ReviewRow {
  id: string;
  fiscalYear: number;
  filingType: string;
  status: string;
  notes: string | null;
}

interface Props {
  clientId: string;
  years: number[];
  reviews: ReviewRow[];
  reviewComplete: boolean;
  /** Groups that apply to this client. The rest are shown greyed out. */
  applicableGroups: ReviewGroup[];
}

export function HistoricalReviewMatrix({ clientId, years, reviews, reviewComplete, applicableGroups }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [complete, setComplete] = useState(reviewComplete);

  function getStatus(year: number, type: string): ReviewStatus {
    const row = reviews.find((r) => r.fiscalYear === year && r.filingType === type);
    return (row?.status as ReviewStatus) ?? "NA";
  }

  async function setStatus(year: number, type: ReviewGroup, status: ReviewStatus) {
    const key = `${year}-${type}`;
    setSavingKey(key);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fiscalYear: year, filingType: type, status }),
      });
      if (!res.ok) throw new Error("Save failed");
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingKey(null);
    }
  }

  async function toggleComplete(next: boolean) {
    setComplete(next);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/review`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewComplete: next }),
      });
      if (!res.ok) throw new Error("Save failed");
      startTransition(() => router.refresh());
    } catch (e) {
      setComplete(reviewComplete);
      setError(e instanceof Error ? e.message : "Save failed");
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-fg">Historical review</h2>
          <p className="mt-1 text-xs text-fg-muted">
            Mark the status of past filings for this client. A group marked Overdue or Outstanding Balance
            creates that year&apos;s filings once the review is complete. Groups that don&apos;t apply to this
            client are greyed out.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={complete}
            onChange={(e) => toggleComplete(e.target.checked)}
            disabled={pending}
            className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
          />
          Mark review complete
        </label>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-fg-muted">
              <th className="py-2 pr-4 font-medium">Fiscal year</th>
              {REVIEW_GROUPS.map((g) => (
                <th key={g} className={`px-4 py-2 font-medium ${applicableGroups.includes(g) ? "" : "text-fg-muted/50"}`}>
                  {REVIEW_GROUP_LABELS[g]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y} className="border-t border-border">
                <td className="py-2 pr-4 font-medium text-fg">{y}</td>
                {REVIEW_GROUPS.map((g) => {
                  const applies = applicableGroups.includes(g);
                  const status = getStatus(y, g);
                  const key = `${y}-${g}`;
                  return (
                    <td key={g} className="px-4 py-2">
                      <select
                        value={status}
                        onChange={(e) => setStatus(y, g, e.target.value as ReviewStatus)}
                        disabled={!applies || (pending && savingKey === key)}
                        title={applies ? undefined : "This group does not apply to this client"}
                        className="rounded-md border border-border bg-bg-subtle px-2 py-1 text-sm text-fg focus:border-ring focus:ring-2 focus:ring-ring/30"
                      >
                        {REVIEW_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {REVIEW_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
