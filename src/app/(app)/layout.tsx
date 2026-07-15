import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { Providers } from "./providers";
import { NavLink } from "@/components/nav-link";
import { NavProgress } from "@/components/nav-progress";
import { isThemeId, DEFAULT_THEME, type ThemeId } from "@/lib/theme";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const initialTheme: ThemeId = isThemeId(user.theme) ? user.theme : DEFAULT_THEME;
  return (
    <Providers initialTheme={initialTheme}>
      <NavProgress />
      <div className="min-h-screen flex flex-col bg-bg text-fg">
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex items-center justify-between px-6 py-3">
            <Link
              href="/dashboard"
              className="font-semibold text-fg rounded-md px-1 py-0.5 transition active:scale-[0.97] hover:text-primary"
            >
              SimpleBookkeeping
            </Link>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-fg-muted">
                {user.name} <span className="text-fg-muted/70">({user.role})</span>
              </span>
              <Link
                href="/api/auth/signout"
                className="rounded-md border border-border bg-bg-subtle px-3 py-1.5 text-fg shadow-sm hover:bg-surface active:scale-[0.98] transition"
              >
                Sign out
              </Link>
            </div>
          </div>
        </header>
        <div className="flex flex-1">
          <aside className="w-56 shrink-0 border-r border-border bg-surface">
            <nav className="flex flex-col gap-1 p-3 text-sm">
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/clients">Clients</NavLink>
              <NavLink href="/payroll">Payroll</NavLink>
              <NavLink href="/gst-hst">GST/HST</NavLink>
              <NavLink href="/t2">Corporate Tax Return</NavLink>
              <NavLink href="/ontario-ar">Ontario AR</NavLink>
              <NavLink href="/federal-ar">Federal AR</NavLink>
              <NavLink href="/info-returns">Info Returns</NavLink>
              <div className="mt-2 border-t border-border pt-2">
                <NavLink href="/monitoring">Monitoring</NavLink>
                <NavLink href="/settings/theme">Theme</NavLink>
                {user.role === "Admin" && <NavLink href="/admin/users">Users</NavLink>}
              </div>
            </nav>
          </aside>
          <main className="flex-1 min-w-0">
            <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
          </main>
        </div>
      </div>
    </Providers>
  );
}
