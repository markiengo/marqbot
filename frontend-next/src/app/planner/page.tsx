"use client";

import { useCourses } from "@/hooks/useCourses";
import { usePrograms } from "@/hooks/usePrograms";
import { useSession } from "@/hooks/useSession";
import { PlannerLayout } from "@/components/planner/PlannerLayout";

export default function PlannerPage() {
  const courses = useCourses();
  const programs = usePrograms();
  useSession();

  const isLoading = !courses?.length || !programs?.majors?.length;

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-navy border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-ink-muted">Loading course data...</p>
        </div>
      </div>
    );
  }

  return <PlannerLayout />;
}
