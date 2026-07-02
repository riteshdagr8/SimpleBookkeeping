"use client";

import { Check, Palette } from "lucide-react";
import { THEMES, type ThemeId } from "@/lib/theme";
import { useTheme } from "@/components/theme-provider";
import { cn } from "@/lib/cn";

export function PaletteGrid() {
  const { theme, setTheme } = useTheme();
  return (
    <section className="rounded-xl border border-border bg-surface p-6 shadow-sm">
      <header className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-bg-subtle text-primary">
          <Palette className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-fg">Color palette</h2>
          <p className="text-sm text-fg-muted">Swap the app&apos;s entire color scheme. Applies instantly.</p>
        </div>
      </header>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {THEMES.map((t) => {
          const isSelected = t.id === theme;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id as ThemeId)}
              aria-pressed={isSelected}
              className={cn(
                "relative flex flex-col items-start gap-3 rounded-lg border bg-surface p-4 text-left transition",
                "hover:border-ring focus:outline-none focus:ring-2 focus:ring-ring/40",
                isSelected
                  ? "border-primary bg-bg-subtle ring-1 ring-primary/40"
                  : "border-border"
              )}
            >
              {isSelected && (
                <span className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-fg">
                  <Check className="h-3 w-3" />
                </span>
              )}
              <div className="flex items-center gap-1.5">
                {t.swatches.map((c) => (
                  <span
                    key={c}
                    aria-hidden
                    className="h-7 w-7 rounded-md border border-border"
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div>
                <div className="text-sm font-semibold text-fg">{t.name}</div>
                <div className="text-xs text-fg-muted">{t.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
