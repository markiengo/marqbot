"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SavedPlansLibraryPage } from "@/components/saved/SavedPlansLibraryPage";
import { SavedPlanDetailPage } from "@/components/saved/SavedPlanDetailPage";
import { SavedPlanPrintView } from "@/components/saved/SavedPlanPrintView";

function SavedPageInner() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan");
  const exportMode = searchParams.get("export");

  if (planId) {
    if (exportMode === "pdf") {
      return <SavedPlanPrintView planId={planId} />;
    }
    return <SavedPlanDetailPage planId={planId} />;
  }

  return <SavedPlansLibraryPage />;
}

export default function SavedPage() {
  return (
    <Suspense>
      <SavedPageInner />
    </Suspense>
  );
}
