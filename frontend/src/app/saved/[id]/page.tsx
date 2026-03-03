import { SavedPlanDetailPage } from "@/components/saved/SavedPlanDetailPage";

export default async function SavedPlanDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SavedPlanDetailPage planId={decodeURIComponent(id)} />;
}
