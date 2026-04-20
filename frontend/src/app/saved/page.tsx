"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SavedPlanPrintView } from "@/components/saved/SavedPlanPrintView";
import { SavedPlansWorkspace } from "@/components/saved/SavedPlansWorkspace";

function SavedPageInner() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan");
  const exportMode = searchParams.get("export");

  if (planId && exportMode === "pdf") {
    return <SavedPlanPrintView planId={planId} />;
  }

  return <SavedPlansWorkspace planId={planId} />;
}

export default function SavedPage() {
  return (
    <Suspense>
      <SavedPageInner />
    </Suspense>
  );
}
