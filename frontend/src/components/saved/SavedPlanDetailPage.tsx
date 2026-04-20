"use client";

import { SavedPlanDetailScaffold } from "./SavedPlansWorkspace";

export function SavedPlanDetailPage({ planId }: { planId: string }) {
  return <SavedPlanDetailScaffold key={planId} planId={planId} />;
}
