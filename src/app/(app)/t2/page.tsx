import {
  buildWorkflowListProps,
  WorkflowListView,
} from "@/app/(app)/workflow-page-helpers";

export default async function T2ListPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; from?: string; to?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const props = await buildWorkflowListProps("T2", sp);
  return <WorkflowListView {...props} />;
}
