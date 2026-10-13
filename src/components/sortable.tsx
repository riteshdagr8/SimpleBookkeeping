"use client";

import { useMemo, useState } from "react";

export type SortDir = "asc" | "desc";
export type SortValue = string | number | null;

/**
 * Client-side table sorting. `accessors` maps a sort key to a comparable value
 * for a row. Pass a module-level constant so the accessor map stays referentially
 * stable across renders (otherwise the memo recomputes every render).
 */
export function useSort<T>(
  rows: T[],
  initialKey: string,
  accessors: Record<string, (row: T) => SortValue>
) {
  const [sortBy, setSortBy] = useState(initialKey);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(() => {
    const accessor = accessors[sortBy];
    if (!accessor) return rows;
    const dir = sortDir === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = accessor(a);
      const bv = accessor(b);
      // Blanks sort last regardless of direction.
      if (av === null && bv === null) return 0;
      if (av === null) return 1;
      if (bv === null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, sortBy, sortDir, accessors]);

  function toggle(key: string) {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  }

  return { sorted, sortBy, sortDir, toggle };
}

export function SortableTh({
  label,
  sortKey,
  sortBy,
  sortDir,
  onToggle,
  className,
}: {
  label: string;
  sortKey: string;
  sortBy: string;
  sortDir: SortDir;
  onToggle: (key: string) => void;
  className?: string;
}) {
  const active = sortBy === sortKey;
  return (
    <th className={className ?? "px-3 py-2 font-medium"}>
      <button
        type="button"
        onClick={() => onToggle(sortKey)}
        className="inline-flex items-center gap-1 font-medium hover:text-fg"
      >
        {label}
        <span className="text-[10px] leading-none">{active ? (sortDir === "asc" ? "▲" : "▼") : ""}</span>
      </button>
    </th>
  );
}
