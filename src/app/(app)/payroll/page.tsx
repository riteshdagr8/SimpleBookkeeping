import {
  buildWorkflowListProps,
  WorkflowListView,
} from "@/app/(app)/workflow-page-helpers";

export default async function PayrollListPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; from?: string; to?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const props = await buildWorkflowListProps("Payroll", sp);
  return <WorkflowListView {...props} />;
}
