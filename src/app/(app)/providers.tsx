"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme-provider";
import type { ThemeId } from "@/lib/theme";

export function Providers({
  initialTheme,
  children,
}: {
  initialTheme: ThemeId;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <ThemeProvider initialTheme={initialTheme}>{children}</ThemeProvider>
    </SessionProvider>
  );
}
