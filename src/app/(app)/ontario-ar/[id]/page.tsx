import {
  buildWorkflowDetailProps,
  WorkflowDetailView,
} from "@/app/(app)/workflow-page-helpers";

export default async function OntarioArDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; clientId?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const props = await buildWorkflowDetailProps("OntarioAR", id, sp);
  return <WorkflowDetailView {...props} />;
}
