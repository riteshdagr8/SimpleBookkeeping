import {
  buildWorkflowListProps,
  WorkflowListView,
} from "@/app/(app)/workflow-page-helpers";

export default async function GstHstListPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; from?: string; to?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const props = await buildWorkflowListProps("GSTHST", sp);
  return <WorkflowListView {...props} />;
}
