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
        "block rounded-md px-3 py-2 text-sm transition-colors",
        isActive
          ? "bg-bg-subtle text-fg font-medium"
          : "text-fg-muted hover:bg-bg-subtle hover:text-fg"
      )}
    >
      {children}
    </Link>
  );
}
