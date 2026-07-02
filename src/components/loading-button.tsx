"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { forwardRef } from "react";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  loadingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

const VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-primary text-primary-fg hover:opacity-90 disabled:opacity-50",
  secondary: "border border-border bg-bg-subtle text-fg hover:bg-surface disabled:opacity-50",
  ghost: "text-fg hover:bg-bg-subtle disabled:opacity-50",
  danger: "bg-danger text-white hover:opacity-90 disabled:opacity-50",
};

export const LoadingButton = forwardRef<HTMLButtonElement, ButtonProps>(function LoadingButton(
  { loading, loadingLabel, variant = "primary", className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition active:scale-[0.98] disabled:cursor-not-allowed",
        VARIANTS[variant],
        className
      )}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? loadingLabel ?? "Working..." : children}
    </button>
  );
});
