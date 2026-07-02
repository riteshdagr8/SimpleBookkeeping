import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { requireUser } from "@/lib/auth";
import { getClient } from "@/lib/services/clients";
import { ClientForm, type ClientFormInitial } from "@/components/client-form";
import { FolderChecklist } from "@/components/folder-checklist";
import { QbPasswordCell } from "@/components/qb-password-cell";
import { lastNCompletedFiscalYears } from "@/lib/services/reviews";

function toInitial(c: NonNullable<Awaited<ReturnType<typeof getClient>>>): ClientFormInitial {
  return {
    id: c.id,
    fileNumber: c.fileNumber,
    legalName: c.legalName,
    businessNumber: c.businessNumber ?? "",
    entityType: c.entityType ?? "",
    fiscalYearEnd: format(c.fiscalYearEnd, "yyyy-MM-dd"),
    incorporationDate: c.incorporationDate ? format(c.incorporationDate, "yyyy-MM-dd") : "",
    incorporationJurisdiction: (c.incorporationJurisdiction as "" | "Federal" | "Ontario") ?? "",
    address: c.address ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    folderPath: c.folderPath ?? "",
    qbPassword: "",
    hstApplicable: c.hstApplicable,
    hstFrequency: (c.hstFrequency as "" | "Monthly" | "Quarterly" | "Annual") ?? "",
    payrollApplicable: c.payrollApplicable,
    payrollFrequency: c.payrollFrequency ?? "",
    remitterType: (c.remitterType as "" | "Regular" | "Quarterly") ?? "",
    threeMonthEligible: c.threeMonthEligible,
    notes: c.notes ?? "",
  };
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const client = await getClient(user.tenantId, id);
  if (!client) notFound();

  const years = lastNCompletedFiscalYears(client.fiscalYearEnd, 3);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">
            {client.legalName}{" "}
            <span className="text-base font-normal text-fg-muted">#{client.fileNumber}</span>
          </h1>
          <p className="text-sm text-fg-muted">
            FYE {format(client.fiscalYearEnd, "MMM d, yyyy")} · BN {client.businessNumber ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/clients/${client.id}/review`}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg hover:bg-bg-subtle"
          >
            Historical review
          </Link>
          <Link
            href={`/clients/${client.id}/schedule`}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:opacity-90"
          >
            Schedule
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-fg">Master data</h2>
            <div className="mt-3">
              <ClientForm initial={toInitial(client)} submitLabel="Save changes" />
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <FolderChecklist
            clientId={client.id}
            items={client.folderChecklist.map((f) => ({
              id: f.id,
              itemName: f.itemName,
              created: f.created,
            }))}
          />
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-fg">QuickBooks password</h2>
            <div className="mt-3">
              <QbPasswordCell
                clientId={client.id}
                hasPassword={!!client.qbPasswordEncrypted}
              />
            </div>
            <p className="mt-2 text-xs text-fg-muted">
              Stored encrypted (AES-256-GCM). Reveal logs an audit event.
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-fg">Review status</h2>
            <p className="mt-1 text-xs text-fg-muted">
              Last 3 fiscal years: {years.join(", ")}
            </p>
            <p className="mt-2 text-sm">
              {client.reviewComplete ? (
                <span className="text-success">Review complete — schedule generation unlocked.</span>
              ) : (
                <span className="text-warning">Review pending — complete it to unlock the schedule.</span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
