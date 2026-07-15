import {
  buildWorkflowListProps,
  WorkflowListView,
} from "@/app/(app)/workflow-page-helpers";

export default async function FederalArListPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; from?: string; to?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const props = await buildWorkflowListProps("FederalAR", sp);
  return <WorkflowListView {...props} />;
}
