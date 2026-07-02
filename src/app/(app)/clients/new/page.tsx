import { ClientForm, emptyClient } from "@/components/client-form";

export default function NewClientPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-fg">New client</h1>
        <p className="text-sm text-fg-muted">Capture corporation details, folder path, and HST/payroll applicability.</p>
      </div>
      <ClientForm initial={emptyClient} submitLabel="Create client" />
    </div>
  );
}
