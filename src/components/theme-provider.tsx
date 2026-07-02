"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { DEFAULT_THEME, THEMES, type ThemeId } from "@/lib/theme";

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (id: ThemeId) => Promise<void>;
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ initialTheme, children }: { initialTheme: ThemeId; children: React.ReactNode }) {
  const { data: session, update } = useSession();
  const [theme, setThemeState] = useState<ThemeId>(initialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setTheme = useCallback(
    async (id: ThemeId) => {
      const previous = theme;
      setThemeState(id);
      try {
        const res = await fetch("/api/me/theme", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: id }),
        });
        if (!res.ok) throw new Error("Failed to save theme");
        // refresh JWT so server-rendered pages pick up the new theme
        await update?.({ theme: id });
      } catch (e) {
        // revert on failure
        setThemeState(previous);
        console.error(e);
      }
    },
    [theme, update]
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, setTheme, ready: !!session }),
    [theme, setTheme, session]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

export { THEMES, DEFAULT_THEME };
export type { ThemeId };
