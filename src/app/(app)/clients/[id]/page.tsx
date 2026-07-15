import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getClient } from "@/lib/services/clients";
import { ClientForm, type ClientFormInitial } from "@/components/client-form";
import { FolderChecklist } from "@/components/folder-checklist";
import { lastNCompletedFiscalYears } from "@/lib/services/reviews";

function formatUTC(d: Date | null, withYear: boolean): string {
  if (!d) return "—";
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  };
  return new Intl.DateTimeFormat("en-US", opts).format(d);
}

function toInitial(c: NonNullable<Awaited<ReturnType<typeof getClient>>>): ClientFormInitial {
  return {
    id: c.id,
    fileNumber: c.fileNumber,
    legalName: c.legalName,
    contactName: c.contactName ?? "",
    businessNumber: c.businessNumber ?? "",
    entityType: c.entityType ?? "",
    fiscalYearEnd: c.fiscalYearEnd.toISOString().slice(0, 10),
    incorporationDate: c.incorporationDate ? c.incorporationDate.toISOString().slice(0, 10) : "",
    incorporationJurisdiction: (c.incorporationJurisdiction as "" | "Federal" | "Ontario") ?? "",
    address: c.address ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    folderPath: c.folderPath ?? "",
    qbPassword: "",
    onboardingStatus: c.onboardingStatus ?? "In Progress",
    hstApplicable: c.hstApplicable,
    hstFrequency: (c.hstFrequency as "" | "Monthly" | "Quarterly" | "Annual" | "SelfEmployed") ?? "",
    payrollApplicable: c.payrollApplicable,
    payrollFrequency: (c.payrollFrequency as "" | "Weekly" | "Bi-Weekly" | "Semi-Monthly" | "Monthly" | "NA") ?? "",
    remitterType: (c.remitterType as "" | "Regular" | "Quarterly" | "Accelerated1" | "Accelerated2") ?? "",
    qbOnlinePayroll: c.qbOnlinePayroll,
    threeMonthEligible: c.threeMonthEligible,
    reviewYears: ((c.reviewYears as 3 | 4 | 5 | 6) ?? 3),
    incorporationDocumentsReceived: c.incorporationDocumentsReceived,
    notes: c.notes ?? "",
  };
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const client = await getClient(user.tenantId, id);
  if (!client) notFound();
  // Staff cannot view inactive clients.
  if (!client.active && user.role !== "Admin") notFound();

  const years = lastNCompletedFiscalYears(client.fiscalYearEnd, client.reviewYears);

  const selfEmployedWarning =
    client.hstApplicable &&
    client.hstFrequency === "SelfEmployed" &&
    (client.fiscalYearEnd.getUTCMonth() !== 11 || client.fiscalYearEnd.getUTCDate() !== 31);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">
            {client.legalName}{" "}
            <span className="text-base font-normal text-fg-muted">#{client.fileNumber}</span>
          </h1>
          <p className="text-sm text-fg-muted">
            FYE {formatUTC(client.fiscalYearEnd, true)} · BN {client.businessNumber ?? "—"}
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

      {!client.active && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          This client is inactive. They are hidden from the dashboard and monitoring. Staff cannot view or edit.
        </div>
      )}

      {selfEmployedWarning && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          Self-employed HST obligations are only auto-generated for a Dec 31 fiscal year-end. Add obligations manually via the schedule page.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-lg border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-fg">Master data</h2>
            <div className="mt-3">
              <ClientForm initial={toInitial(client)} submitLabel="Save changes" reviewComplete={client.reviewComplete} />
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
            <h2 className="text-sm font-semibold text-fg">Review status</h2>
            <p className="mt-1 text-xs text-fg-muted">
              Last {client.reviewYears} fiscal year{client.reviewYears === 1 ? "" : "s"}: {years.join(", ")}
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
