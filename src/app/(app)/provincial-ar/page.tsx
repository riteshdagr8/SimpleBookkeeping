import {
  buildWorkflowListProps,
  WorkflowListView,
} from "@/app/(app)/workflow-page-helpers";

export default async function ProvincialARListPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; province?: string; fyeMonth?: string; frequency?: string; from?: string; to?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const props = await buildWorkflowListProps("ProvincialAR", sp);
  return <WorkflowListView {...props} />;
}
