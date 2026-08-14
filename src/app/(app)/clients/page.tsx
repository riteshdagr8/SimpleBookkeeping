import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listClients } from "@/lib/services/clients";
import { ClientsList, type ClientRow } from "./clients-list";

export default async function ClientsListPage() {
  const user = await requireUser();
  const clients = await listClients(user.tenantId);
  const rows: ClientRow[] = clients.map((c) => ({
    id: c.id,
    fileNumber: c.fileNumber,
    legalName: c.legalName,
    businessNumber: c.businessNumber,
    phone: c.phone,
    primaryEmail: c.primaryEmail,
    secondaryEmail: c.secondaryEmail,
    fiscalYearEnd: c.fiscalYearEnd.toISOString(),
    reviewComplete: c.reviewComplete,
    onboardingStatus: c.onboardingStatus,
    active: c.active,
  }));

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

      <ClientsList clients={rows} userRole={user.role} />
    </div>
  );
}
