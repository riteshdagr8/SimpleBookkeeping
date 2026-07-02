import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listClients } from "@/lib/services/clients";
import { format } from "date-fns";

export default async function ClientsListPage() {
  const user = await requireUser();
  const clients = await listClients(user.tenantId);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Clients</h1>
          <p className="text-sm text-fg-muted">All corporations under your tenant.</p>
        </div>
        <Link
          href="/clients/new"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90"
        >
          New client
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="min-w-full text-sm">
          <thead className="bg-bg-subtle text-left text-xs text-fg-muted">
            <tr>
              <th className="px-4 py-2 font-medium">File #</th>
              <th className="px-4 py-2 font-medium">Legal name</th>
              <th className="px-4 py-2 font-medium">BN</th>
              <th className="px-4 py-2 font-medium">FYE</th>
              <th className="px-4 py-2 font-medium">Review</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-fg-muted">
                  No clients yet. <Link href="/clients/new" className="text-primary hover:underline">Create the first one</Link>.
                </td>
              </tr>
            )}
            {clients.map((c) => (
              <tr key={c.id} className="border-t border-border">
                <td className="px-4 py-2 font-medium text-fg">{c.fileNumber}</td>
                <td className="px-4 py-2 text-fg">{c.legalName}</td>
                <td className="px-4 py-2 text-fg-muted">{c.businessNumber ?? "—"}</td>
                <td className="px-4 py-2 text-fg-muted">{format(c.fiscalYearEnd, "MMM d, yyyy")}</td>
                <td className="px-4 py-2">
                  {c.reviewComplete ? (
                    <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">Complete</span>
                  ) : (
                    <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">Pending</span>
                  )}
                </td>
                <td className="px-4 py-2 text-fg-muted">{c.onboardingStatus}</td>
                <td className="px-4 py-2 text-right">
                  <Link href={`/clients/${c.id}`} className="text-primary hover:underline">
                    Open
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
