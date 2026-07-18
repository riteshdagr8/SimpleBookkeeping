"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { ConfirmDialog } from "@/components/confirm-dialog";

export interface ClientFormInitial {
  id?: string;
  fileNumber: string;
  legalName: string;
  contactName: string;
  businessNumber: string;
  entityType: string;
  fiscalYearEnd: string; // yyyy-mm-dd (always day 01)
  incorporationDate: string;
  incorporationJurisdiction: "" | "Federal" | "Ontario";
  address: string;
  phone: string;
  email: string;
  folderPath: string;
  qbPassword: string;
  onboardingStatus: string;
  hstApplicable: boolean;
  hstFrequency: "" | "Monthly" | "Quarterly" | "Annual" | "SelfEmployed";
  payrollApplicable: boolean;
  payrollFrequency: "" | "Weekly" | "Bi-Weekly" | "Semi-Monthly" | "Monthly" | "NA";
  remitterType: "" | "Regular" | "Quarterly" | "Accelerated1" | "Accelerated2";
  qbOnlinePayroll: boolean;
  threeMonthEligible: boolean;
  reviewYears: 3 | 4 | 5 | 6;
  incorporationDocumentsReceived: boolean;
  notes: string;
}

export const emptyClient: ClientFormInitial = {
  fileNumber: "",
  legalName: "",
  contactName: "",
  businessNumber: "",
  entityType: "",
  fiscalYearEnd: "",
  incorporationDate: "",
  incorporationJurisdiction: "",
  address: "",
  phone: "",
  email: "",
  folderPath: "",
  qbPassword: "",
  onboardingStatus: "In Progress",
  hstApplicable: false,
  hstFrequency: "",
  payrollApplicable: false,
  payrollFrequency: "",
  remitterType: "",
  qbOnlinePayroll: false,
  threeMonthEligible: false,
  reviewYears: 3,
  incorporationDocumentsReceived: false,
  notes: "",
};

const MONTH_OPTIONS = [
  "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12",
] as const;
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

function fyeToMonth(fye: string): string {
  if (!fye) return "";
  const m = fye.slice(5, 7);
  return MONTH_OPTIONS.includes(m as (typeof MONTH_OPTIONS)[number]) ? m : "";
}

function fyeFromMonth(year: string, month: string): string {
  if (!year || !month) return "";
  return `${year}-${month}-01`;
}

export function ClientForm({
  initial,
  submitLabel,
  reviewComplete = false,
}: {
  initial: ClientFormInitial;
  submitLabel: string;
  reviewComplete?: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ClientFormInitial>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showQb, setShowQb] = useState(false);
  const [qbLoading, setQbLoading] = useState(!!initial.id);
  const [qbLoaded, setQbLoaded] = useState<string | null>(null);
  const [inactiveConfirm, setInactiveConfirm] = useState(false);

  function handleStatusChange(value: string) {
    if (value === "Inactive" && form.onboardingStatus !== "Inactive") {
      setInactiveConfirm(true);
    } else {
      set("onboardingStatus", value);
    }
  }

  useEffect(() => {
    setForm(initial);
  }, [initial.id, initial.fileNumber, initial.legalName, initial.fiscalYearEnd, initial.incorporationDate, initial.contactName]);

  useEffect(() => {
    if (!initial.id) return;
    setQbLoading(true);
    fetch(`/api/me/qb-secret/${initial.id}`, { method: "POST" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data && typeof data.password === "string") {
          setQbLoaded(data.password || null);
          if (data.password) {
            setForm((f) => ({ ...f, qbPassword: data.password }));
          }
        }
      })
      .catch(() => {})
      .finally(() => setQbLoading(false));
  }, [initial.id]);

  function set<K extends keyof ClientFormInitial>(key: K, value: ClientFormInitial[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function payload() {
    return {
      fileNumber: form.fileNumber.trim(),
      legalName: form.legalName.trim(),
      contactName: form.contactName || null,
      businessNumber: form.businessNumber || null,
      entityType: form.entityType || null,
      fiscalYearEnd: form.fiscalYearEnd || null,
      incorporationDate: form.incorporationDate || null,
      incorporationJurisdiction: form.incorporationJurisdiction || null,
      address: form.address || null,
      phone: form.phone || null,
      email: form.email || null,
      folderPath: form.folderPath || null,
      qbPassword: form.qbPassword || null,
      onboardingStatus: form.onboardingStatus,
      hstApplicable: form.hstApplicable,
      hstFrequency: form.hstApplicable ? form.hstFrequency || null : null,
      payrollApplicable: form.payrollApplicable,
      payrollFrequency: form.payrollApplicable ? form.payrollFrequency || null : null,
      remitterType: form.payrollApplicable ? form.remitterType || null : null,
      qbOnlinePayroll: form.payrollApplicable ? form.qbOnlinePayroll : false,
      threeMonthEligible: form.threeMonthEligible,
      reviewYears: form.reviewYears,
      incorporationDocumentsReceived: form.incorporationDocumentsReceived,
      notes: form.notes || null,
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.fileNumber || !form.legalName || !form.fiscalYearEnd) {
      setError("File number, legal name, and fiscal year-end are required.");
      return;
    }
    setLoading(true);
    try {
      const url = initial.id ? `/api/clients/${initial.id}` : "/api/clients";
      const method = initial.id ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Save failed");
      }
      const data = (await res.json()) as { client?: { id: string } };
      router.push(`/clients/${data.client?.id ?? initial.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  const fyeYear = form.fiscalYearEnd ? form.fiscalYearEnd.slice(0, 4) : String(new Date().getFullYear());
  const fyeMonth = fyeToMonth(form.fiscalYearEnd);

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="File number *" value={form.fileNumber} onChange={(v) => set("fileNumber", v)} required />
        <Field label="Legal name *" value={form.legalName} onChange={(v) => set("legalName", v)} required />
        <Field label="Contact name" value={form.contactName} onChange={(v) => set("contactName", v)} />
        <Field
          label="Business number (9 digits)"
          value={form.businessNumber}
          onChange={(v) => set("businessNumber", v.replace(/\D/g, "").slice(0, 9))}
          placeholder="123456789"
          inputMode="numeric"
          maxLength={9}
        />
        <SelectField
          label="Entity type"
          value={form.entityType}
          onChange={(v) => set("entityType", v)}
          options={["", "Corporation", "Individual", "Partnership"]}
        />
        <SelectField
          label="Fiscal year-end (month) *"
          value={fyeMonth}
          onChange={(v) => set("fiscalYearEnd", fyeFromMonth(fyeYear, v))}
          options={MONTH_OPTIONS as readonly string[]}
          optionLabels={Object.fromEntries(
            MONTH_OPTIONS.map((m, i) => [m, MONTH_NAMES[i]])
          )}
          required
        />
        <Field
          label="Incorporation date"
          type="date"
          value={form.incorporationDate}
          onChange={(v) => set("incorporationDate", v)}
        />
        <SelectField
          label="Incorporation jurisdiction"
          value={form.incorporationJurisdiction}
          onChange={(v) => set("incorporationJurisdiction", v as ClientFormInitial["incorporationJurisdiction"])}
          options={["", "Federal", "Ontario"]}
        />
        <SelectField
          label="Status"
          value={form.onboardingStatus}
          onChange={handleStatusChange}
          options={["In Progress", "Onboarded", "Waiting on Documents", "Inactive"]}
        />
        <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
        <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
        <Field label="Folder path" value={form.folderPath} onChange={(v) => set("folderPath", v)} />
      </div>

      {/* Address and QuickBooks password — side by side */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Address" value={form.address} onChange={(v) => set("address", v)} />

        <div>
          <label className="block text-sm font-medium text-fg">QuickBooks password</label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type={showQb ? "text" : "password"}
              value={qbLoaded !== null ? qbLoaded : form.qbPassword}
              autoComplete="new-password"
              disabled={qbLoading}
              placeholder={qbLoading ? "Loading..." : ""}
              onChange={(e) => {
                setQbLoaded(e.target.value);
                set("qbPassword", e.target.value);
              }}
              className="block w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-fg outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => !qbLoading && setShowQb((s) => !s)}
              disabled={qbLoading}
              title={showQb ? "Hide password" : "Show password"}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-bg-subtle text-fg hover:bg-surface disabled:opacity-50"
            >
              {showQb ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Payroll */}
      <fieldset className="rounded-lg border border-border px-3 py-2">
        <legend className="px-2 text-sm font-medium text-fg">Payroll</legend>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.payrollApplicable}
              onChange={(e) => set("payrollApplicable", e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
            />
            Payroll applicable
          </label>
          <SelectField
            label="Frequency"
            value={form.payrollFrequency}
            onChange={(v) => set("payrollFrequency", v as ClientFormInitial["payrollFrequency"])}
            options={["", "Weekly", "Bi-Weekly", "Semi-Monthly", "Monthly", "NA"]}
            optionLabels={{ NA: "N/A" }}
            disabled={!form.payrollApplicable}
          />
          <SelectField
            label="CRA Remitter"
            value={form.remitterType}
            onChange={(v) => set("remitterType", v as ClientFormInitial["remitterType"])}
            options={["", "Regular", "Quarterly", "Accelerated1", "Accelerated2"]}
            optionLabels={{
              Accelerated1: "Accelerated (Threshold 1)",
              Accelerated2: "Accelerated (Threshold 2)",
            }}
            disabled={!form.payrollApplicable}
          />
          <label className="inline-flex items-center gap-2 text-sm whitespace-nowrap">
            <input
              type="checkbox"
              checked={form.qbOnlinePayroll}
              onChange={(e) => set("qbOnlinePayroll", e.target.checked)}
              disabled={!form.payrollApplicable}
              className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
            />
            QuickBooks Online Payroll?
          </label>
        </div>
      </fieldset>

      {/* GST/HST + T2 side by side */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <fieldset className="rounded-lg border border-border px-3 py-2">
          <legend className="px-2 text-sm font-medium text-fg">GST/HST</legend>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.hstApplicable}
                onChange={(e) => set("hstApplicable", e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
              />
              GST/HST applicable
            </label>
            <SelectField
              label="Frequency"
              value={form.hstFrequency}
              onChange={(v) => set("hstFrequency", v as ClientFormInitial["hstFrequency"])}
              options={["", "Monthly", "Quarterly", "Annual", "SelfEmployed"]}
              optionLabels={{ SelfEmployed: "Annual (Self-employed)" }}
              disabled={!form.hstApplicable}
            />
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-border px-3 py-2">
          <legend className="px-2 text-sm font-medium text-fg">T2 (Corporate tax)</legend>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.threeMonthEligible}
              onChange={(e) => set("threeMonthEligible", e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
            />
            3-month eligible corporation (balance due 3 months after FYE)
          </label>
        </fieldset>
      </div>

      {/* Historical review + Documents — aligned with Address/QB columns */}
      <fieldset className="rounded-lg border border-border px-3 py-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium text-fg whitespace-nowrap">Historical years to review</span>
            <select
              value={String(form.reviewYears)}
              onChange={(e) => set("reviewYears", (Number(e.target.value) as 3 | 4 | 5 | 6))}
              className="rounded-md border border-border bg-bg-subtle px-2 py-1.5 text-sm text-fg outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              {["3", "4", "5", "6"].map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            {reviewComplete && (
              <p className="text-xs text-warning">Review is complete — change requires reopening review.</p>
            )}
          </div>
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.incorporationDocumentsReceived}
              onChange={(e) => set("incorporationDocumentsReceived", e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
            />
            Incorporation documents received?
          </label>
        </div>
      </fieldset>

      <TextareaField
        label="Notes"
        value={form.notes}
        onChange={(v) => set("notes", v)}
        rows={3}
      />

      {error && (
        <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Saving..." : submitLabel}
        </button>
      </div>

      <ConfirmDialog
        open={inactiveConfirm}
        title="Inactivate client?"
        message="This will hide the client from the dashboard and monitoring. Staff will not be able to view or edit. You can reactivate later."
        confirmLabel="Inactivate"
        cancelLabel="Cancel"
        tone="danger"
        onConfirm={() => {
          set("onboardingStatus", "Inactive");
          setInactiveConfirm(false);
        }}
        onCancel={() => setInactiveConfirm(false)}
      />
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  className,
  disabled,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  inputMode?: "text" | "numeric" | "decimal" | "email";
  maxLength?: number;
}) {
  return (
    <label className={`block text-sm ${className ?? ""}`}>
      <span className="font-medium text-fg">{label}</span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        inputMode={inputMode}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-fg outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  disabled,
  optionLabels,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  disabled?: boolean;
  optionLabels?: Record<string, string>;
  required?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-fg">{label}{required ? " *" : ""}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-fg outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o || "blank"} value={o}>
            {o ? (optionLabels?.[o] ?? o) : "—"}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  rows = 4,
  className,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <label className={`block text-sm ${className ?? ""}`}>
      <span className="font-medium text-fg">{label}</span>
      <textarea
        value={value}
        rows={rows}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-fg outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
      />
    </label>
  );
}
