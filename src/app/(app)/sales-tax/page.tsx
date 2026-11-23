import {
  buildWorkflowListProps,
  WorkflowListView,
} from "@/app/(app)/workflow-page-helpers";

export default async function SalesTaxListPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; province?: string; fyeMonth?: string; frequency?: string; from?: string; to?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const props = await buildWorkflowListProps("SalesTax", sp);
  return <WorkflowListView {...props} />;
}
