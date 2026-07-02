"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive =
    href === "/dashboard"
      ? pathname === "/" || pathname === "/dashboard"
      : pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "rounded-md px-2 py-1 transition-colors active:scale-[0.97]",
        isActive
          ? "bg-bg-subtle text-fg font-medium"
          : "text-fg-muted hover:bg-bg-subtle hover:text-fg"
      )}
    >
      {children}
    </Link>
  );
}
