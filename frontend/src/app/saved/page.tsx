"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SavedPlansLibraryPage } from "@/components/saved/SavedPlansLibraryPage";
import { SavedPlanDetailPage } from "@/components/saved/SavedPlanDetailPage";

function SavedPageInner() {
  const searchParams = useSearchParams();
  const planId = searchParams.get("plan");

  if (planId) {
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
