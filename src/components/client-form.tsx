"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export interface ClientFormInitial {
  id?: string;
  fileNumber: string;
  legalName: string;
  businessNumber: string;
  entityType: string;
  fiscalYearEnd: string; // yyyy-mm-dd
  incorporationDate: string;
  incorporationJurisdiction: "" | "Federal" | "Ontario";
  address: string;
  phone: string;
  email: string;
  folderPath: string;
  qbPassword: string;
  hstApplicable: boolean;
  hstFrequency: "" | "Monthly" | "Quarterly" | "Annual";
  payrollApplicable: boolean;
  payrollFrequency: string;
  remitterType: "" | "Regular" | "Quarterly";
  threeMonthEligible: boolean;
  notes: string;
}

export const emptyClient: ClientFormInitial = {
  fileNumber: "",
  legalName: "",
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
  hstApplicable: false,
  hstFrequency: "",
  payrollApplicable: false,
  payrollFrequency: "",
  remitterType: "",
  threeMonthEligible: false,
  notes: "",
};

export function ClientForm({
  initial,
  submitLabel,
}: {
  initial: ClientFormInitial;
  submitLabel: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ClientFormInitial>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof ClientFormInitial>(key: K, value: ClientFormInitial[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function payload() {
    return {
      fileNumber: form.fileNumber.trim(),
      legalName: form.legalName.trim(),
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
      hstApplicable: form.hstApplicable,
      hstFrequency: form.hstApplicable ? form.hstFrequency || null : null,
      payrollApplicable: form.payrollApplicable,
      payrollFrequency: form.payrollApplicable ? form.payrollFrequency || null : null,
      remitterType: form.payrollApplicable ? form.remitterType || null : null,
      threeMonthEligible: form.threeMonthEligible,
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

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="File number *" value={form.fileNumber} onChange={(v) => set("fileNumber", v)} required />
        <Field label="Legal name *" value={form.legalName} onChange={(v) => set("legalName", v)} required />
        <Field label="Business number" value={form.businessNumber} onChange={(v) => set("businessNumber", v)} />
        <SelectField
          label="Entity type"
          value={form.entityType}
          onChange={(v) => set("entityType", v)}
          options={["", "Corporation", "Individual", "Partnership"]}
        />
        <Field
          label="Fiscal year-end *"
          type="date"
          value={form.fiscalYearEnd}
          onChange={(v) => set("fiscalYearEnd", v)}
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
        <Field label="Email" type="email" value={form.email} onChange={(v) => set("email", v)} />
        <Field label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
        <Field label="Folder path" value={form.folderPath} onChange={(v) => set("folderPath", v)} className="sm:col-span-2" />
        <Field
          label="QuickBooks password"
          type="password"
          value={form.qbPassword}
          onChange={(v) => set("qbPassword", v)}
          placeholder={initial.id ? "(unchanged)" : ""}
          className="sm:col-span-2"
        />
        <Field label="Address" value={form.address} onChange={(v) => set("address", v)} className="sm:col-span-2" />
        <Field label="Notes" value={form.notes} onChange={(v) => set("notes", v)} className="sm:col-span-2" />
      </div>

      <fieldset className="rounded-lg border border-border p-4">
        <legend className="px-2 text-sm font-medium text-fg">HST</legend>
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.hstApplicable}
              onChange={(e) => set("hstApplicable", e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
            />
            HST applicable
          </label>
          <SelectField
            label="Frequency"
            value={form.hstFrequency}
            onChange={(v) => set("hstFrequency", v as ClientFormInitial["hstFrequency"])}
            options={["", "Monthly", "Quarterly", "Annual"]}
            disabled={!form.hstApplicable}
          />
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-border p-4">
        <legend className="px-2 text-sm font-medium text-fg">Payroll</legend>
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.payrollApplicable}
              onChange={(e) => set("payrollApplicable", e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
            />
            Payroll applicable
          </label>
          <Field
            label="Frequency"
            value={form.payrollFrequency}
            onChange={(v) => set("payrollFrequency", v)}
            placeholder="e.g. Monthly"
            disabled={!form.payrollApplicable}
          />
          <SelectField
            label="Remitter type"
            value={form.remitterType}
            onChange={(v) => set("remitterType", v as ClientFormInitial["remitterType"])}
            options={["", "Regular", "Quarterly"]}
            disabled={!form.payrollApplicable}
          />
        </div>
      </fieldset>

      <fieldset className="rounded-lg border border-border p-4">
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-fg">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-border bg-bg-subtle px-3 py-2 text-fg outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o || "blank"} value={o}>
            {o || "—"}
          </option>
        ))}
      </select>
    </label>
  );
}
