"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/shared/Button";
import { useCourses } from "@/hooks/useCourses";
import { usePrograms } from "@/hooks/usePrograms";
import { useSavedPlans } from "@/hooks/useSavedPlans";
import {
  formatSavedPlanDate,
  getSavedPlanFreshnessCopy,
  resolveProgramLabels,
} from "@/lib/savedPlanPresentation";
import { buildSavedPlanExportData } from "@/lib/savedPlanExport";
import type { Course } from "@/lib/types";

function chunkSemesters<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function makeCourseCatalogMap(catalog: Course[]): Map<string, Course> {
  const map = new Map<string, Course>();
  for (const course of catalog) {
    map.set(course.course_code, course);
  }
  return map;
}

function buildHistoryPreview(
  courseCodes: string[],
  catalogMap: Map<string, Course>,
) {
  const normalized = courseCodes
    .map((courseCode) => String(courseCode || "").trim())
    .filter(Boolean);
  const visible = normalized.map((courseCode) => ({
    courseCode,
    courseName: String(catalogMap.get(courseCode)?.course_name || courseCode).trim() || courseCode,
  }));
  return {
    visible,
    totalCount: normalized.length,
  };
}

export function SavedPlanPrintView({ planId }: { planId: string }) {
  const { courses, loading: coursesLoading, error: coursesError, retry: retryCourses } = useCourses();
  const {
    programs,
    loading: programsLoading,
    error: programsError,
    retry: retryPrograms,
  } = usePrograms();
  const { hydrated, storageError, loadPlan, getFreshness } = useSavedPlans();
  const printTriggeredRef = useRef(false);

  const plan = loadPlan(planId);
  const isLoading =
    coursesLoading ||
    programsLoading ||
    (!courses.length && !coursesError) ||
    (!programs.majors.length && !programsError);

  const bootstrapError =
    (!courses.length ? coursesError : null) ??
    (!programs.majors.length ? programsError : null);

  const exportData = useMemo(
    () => (plan ? buildSavedPlanExportData(plan, courses, programs) : null),
    [courses, plan, programs],
  );
  const freshness = plan ? getFreshness(plan) : "missing";
  const freshnessCopy = getSavedPlanFreshnessCopy(freshness);

  const majorLabels = useMemo(
    () => (plan ? resolveProgramLabels(plan.inputs.declaredMajors, programs.majors) : []),
    [plan, programs.majors],
  );
  const trackLabels = useMemo(
    () => (plan ? resolveProgramLabels(plan.inputs.declaredTracks, programs.tracks) : []),
    [plan, programs.tracks],
  );
  const minorLabels = useMemo(
    () => (plan ? resolveProgramLabels(plan.inputs.declaredMinors, programs.minors) : []),
    [plan, programs.minors],
  );
  const catalogMap = useMemo(() => makeCourseCatalogMap(courses), [courses]);
  const semesterPages = useMemo(
    () => chunkSemesters(exportData?.semesters ?? [], 2),
    [exportData],
  );
  const completedPreview = useMemo(
    () => buildHistoryPreview(plan?.inputs.completed ?? [], catalogMap),
    [catalogMap, plan?.inputs.completed],
  );
  const inProgressPreview = useMemo(
    () => buildHistoryPreview(plan?.inputs.inProgress ?? [], catalogMap),
    [catalogMap, plan?.inputs.inProgress],
  );

  useEffect(() => {
    if (!hydrated || isLoading || !plan?.recommendationData || !exportData || printTriggeredRef.current) return;
    if (typeof window === "undefined" || typeof window.print !== "function") return;
    printTriggeredRef.current = true;
    window.setTimeout(() => {
      window.print();
    }, 60);
  }, [exportData, hydrated, isLoading, plan?.recommendationData]);

  const handleRetry = () => {
    if (!courses.length) retryCourses();
    if (!programs.majors.length) retryPrograms();
  };

  if (!hydrated || isLoading) {
    return (
      <div className="saved-plan-print-view print-paper print-paper--empty">
        <p className="print-kicker">Preparing export</p>
        <p className="print-muted">Loading saved plan data...</p>
      </div>
    );
  }

  if (bootstrapError) {
    return (
      <div className="saved-plan-print-view print-paper print-paper--empty">
        <div className="print-screen-only print-toolbar" data-testid="saved-plan-print-toolbar">
          <Button asChild variant="ghost" size="sm">
            <Link href={planId ? `/saved?plan=${encodeURIComponent(planId)}` : "/saved"}>Back to Saved Plan</Link>
          </Button>
          <Button variant="gold" size="sm" onClick={handleRetry}>Try Again</Button>
        </div>
        <h1 className="print-title">Could not prepare this export</h1>
        <p className="print-muted">{bootstrapError}</p>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="saved-plan-print-view print-paper print-paper--empty">
        <div className="print-screen-only print-toolbar" data-testid="saved-plan-print-toolbar">
          <Button asChild variant="ghost" size="sm">
            <Link href="/saved">Back to Saved Plans</Link>
          </Button>
        </div>
        <h1 className="print-title">Saved plan not found</h1>
        <p className="print-muted">This local saved-plan record is missing.</p>
      </div>
    );
  }

  if (!plan.recommendationData || !exportData) {
    return (
      <div className="saved-plan-print-view print-paper print-paper--empty">
        <div className="print-screen-only print-toolbar" data-testid="saved-plan-print-toolbar">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/saved?plan=${encodeURIComponent(plan.id)}`}>Back to Saved Plan</Link>
          </Button>
        </div>
        <p className="print-kicker">PDF export unavailable</p>
        <h1 className="print-title">{plan.name}</h1>
        <p className="print-muted">PDF export requires a saved recommendation snapshot for this plan.</p>
      </div>
    );
  }

  return (
    <div className="saved-plan-print-view" data-testid="saved-plan-print-view">
      <div className="print-screen-only print-toolbar" data-testid="saved-plan-print-toolbar">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/saved?plan=${encodeURIComponent(plan.id)}`}>Back to Saved Plan</Link>
        </Button>
        <Button variant="gold" size="sm" onClick={() => window.print()}>Print / Save as PDF</Button>
      </div>

      <div className="print-paper-stack">
        <article className="print-paper">
          <header className="print-header">
            <p className="print-kicker">Saved plan</p>
            <h1 className="print-title">{exportData.planName}</h1>
            <p className="print-subtitle">{exportData.programLine || "Program summary unavailable"}</p>
            <div className="print-meta-grid print-meta-grid--summary">
              <div>
                <span className="print-meta-label">Target semester</span>
                <span>{exportData.targetSemester}</span>
              </div>
              <div>
                <span className="print-meta-label">Updated</span>
                <span>{formatSavedPlanDate(exportData.updatedAt)}</span>
              </div>
              <div>
                <span className="print-meta-label">Freshness</span>
                <span>{freshnessCopy.label}</span>
              </div>
              <div>
                <span className="print-meta-label">Pacing</span>
                <span>{plan.inputs.semesterCount} terms · {plan.inputs.maxRecs} max / term</span>
              </div>
              <div>
                <span className="print-meta-label">Summer</span>
                <span>{plan.inputs.includeSummer ? "Included" : "Skipped"}</span>
              </div>
              <div>
                <span className="print-meta-label">Snapshot</span>
                <span>{plan.recommendationData ? "Saved snapshot available" : "No saved snapshot"}</span>
              </div>
            </div>
            <div className="print-meta-grid">
              <div>
                <span className="print-meta-label">Majors</span>
                <span>{majorLabels.length > 0 ? majorLabels.join(", ") : "None"}</span>
              </div>
              <div>
                <span className="print-meta-label">Tracks</span>
                <span>{trackLabels.length > 0 ? trackLabels.join(", ") : "None"}</span>
              </div>
              <div>
                <span className="print-meta-label">Minors</span>
                <span>{minorLabels.length > 0 ? minorLabels.join(", ") : "None"}</span>
              </div>
            </div>
            {exportData.planNotes ? (
              <section className="print-section print-section--tight">
                <div className="print-section-header">
                  <h2>Note</h2>
                </div>
                <p className="print-notes">{exportData.planNotes}</p>
              </section>
            ) : null}
          </header>

          <section className="print-section print-history-section">
            <div className="print-section-header">
              <h2>Completed & In Progress</h2>
            </div>
            <div className="print-history-grid">
              <section className="print-card print-history-card">
                <div className="print-history-header">
                  <h3>Completed</h3>
                  <span className="print-history-summary">{completedPreview.totalCount} courses</span>
                </div>
                {completedPreview.visible.length > 0 ? (
                  <ul className="print-course-list print-history-list">
                    {completedPreview.visible.map((course) => (
                      <li key={`completed-${course.courseCode}`}>
                        <span className="print-course-code">{course.courseCode}</span>
                        <span className="print-history-course-title">{course.courseName}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="print-muted">None</p>
                )}
              </section>

              <section className="print-card print-history-card">
                <div className="print-history-header">
                  <h3>In Progress</h3>
                  <span className="print-history-summary">{inProgressPreview.totalCount} courses</span>
                </div>
                {inProgressPreview.visible.length > 0 ? (
                  <ul className="print-course-list print-history-list">
                    {inProgressPreview.visible.map((course) => (
                      <li key={`in-progress-${course.courseCode}`}>
                        <span className="print-course-code">{course.courseCode}</span>
                        <span className="print-history-course-title">{course.courseName}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="print-muted">None</p>
                )}
              </section>
            </div>
          </section>

          {storageError ? (
            <p className="print-muted">{storageError}</p>
          ) : null}
        </article>

        {semesterPages.map((semesterGroup, pageIndex) => (
          <article key={`semester-page-${pageIndex}`} className="print-paper print-paper-semesters">
            <section className="print-section">
              <div className="print-section-header">
                <h2>Semester Plan</h2>
                <span className="print-semester-page-caption">
                  Page {pageIndex + 2}
                </span>
              </div>
              <div className="print-semester-stack">
                {semesterGroup.map((semester) => (
                  <section
                    key={`${semester.targetSemester}-${semester.standingLabel || ""}`}
                    className="print-card print-semester-card"
                  >
                    <div className="print-semester-header">
                      <div>
                        <h3>{semester.targetSemester}</h3>
                        {semester.standingLabel ? (
                          <p className="print-muted">{semester.standingLabel}</p>
                        ) : null}
                      </div>
                      <span className="print-semester-summary">
                        {semester.courses.length} {semester.courses.length === 1 ? "course" : "courses"}
                      </span>
                    </div>
                    {semester.courses.length > 0 ? (
                      <table className="print-semester-table">
                        <thead>
                          <tr>
                            <th className="print-semester-table-col-course">Course</th>
                            <th className="print-semester-table-col-title">Title</th>
                            <th className="print-semester-table-col-credits">Credits</th>
                            <th className="print-semester-table-col-prereq">Prereq</th>
                            <th className="print-semester-table-col-satisfy">Satisfy</th>
                          </tr>
                        </thead>
                        <tbody>
                          {semester.courses.map((course) => (
                            <tr key={`${semester.targetSemester}-${course.courseCode}`}>
                              <td className="print-semester-table-code">{course.courseCode}</td>
                              <td className="print-semester-table-title">{course.courseName}</td>
                              <td className="print-semester-table-credits">{course.credits ?? "-"}</td>
                              <td className="print-semester-table-prereq">{course.prereqText}</td>
                              <td className="print-semester-table-buckets">
                                {course.bucketLabels.length > 0 ? course.bucketLabels.join(", ") : "None"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="print-muted">No recommended courses.</p>
                    )}
                  </section>
                ))}
              </div>
            </section>
          </article>
        ))}
      </div>
    </div>
  );
}
