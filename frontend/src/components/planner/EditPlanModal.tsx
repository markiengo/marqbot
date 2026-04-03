"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import type { SemesterData } from "@/lib/types";

interface EditPlanModalProps {
  open: boolean;
  onClose: () => void;
  semesters: SemesterData[];
  onEditSemester: (index: number) => void;
}

export function EditPlanModal({
  open,
  onClose,
  semesters,
  onEditSemester,
}: EditPlanModalProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const handleClose = () => {
    setSelectedIndex(null);
    onClose();
  };

  const selectedSemester = selectedIndex !== null ? semesters[selectedIndex] : null;
  const previewCodes = useMemo(
    () => selectedSemester?.recommendations?.slice(0, 5).map((course) => course.course_code) ?? [],
    [selectedSemester],
  );

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Edit Plan"
      titleClassName="!text-[clamp(1.55rem,3.2vw,2.2rem)] font-semibold font-[family-name:var(--font-sora)] text-ink-primary"
      size="planner-detail"
    >
      <div className="space-y-5">
        <div className="rounded-2xl border border-border-card bg-[linear-gradient(135deg,rgba(255,204,0,0.08),rgba(0,114,206,0.05))] px-4 py-3">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-gold-light">Edit Flow</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-secondary">
            Pick a semester first. We&apos;ll open the existing semester editor so you can swap, add, or remove courses.
          </p>
        </div>

        {semesters.length === 0 ? (
          <div className="rounded-2xl border border-border-subtle bg-surface-card/45 px-4 py-8 text-center">
            <p className="text-base font-semibold text-ink-primary">No semesters available yet.</p>
            <p className="mt-2 text-sm text-ink-secondary">
              Generate a plan first, then come back to edit a semester.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <div className="rounded-2xl border border-border-card bg-surface-card/45 p-2">
              <p className="px-2 pb-2 pt-1 text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-ink-faint">
                Semesters
              </p>
              <div className="max-h-[26rem] space-y-2 overflow-y-auto pr-1">
                {semesters.map((semester, index) => {
                  const isActive = index === selectedIndex;
                  const courseCount = semester.recommendations?.length ?? 0;
                  return (
                    <button
                      key={`${semester.target_semester || "semester"}-${index}`}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                        isActive
                          ? "border-gold/35 bg-gold/10"
                          : "border-border-subtle bg-[rgba(7,18,39,0.4)] hover:border-[#8ec8ff]/28 hover:bg-[rgba(0,114,206,0.08)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-ink-primary">Semester {index + 1}</p>
                          <p className="mt-0.5 text-xs text-ink-secondary">
                            {semester.target_semester || "Auto-selected term"}
                          </p>
                        </div>
                        <span className="rounded-full border border-border-subtle px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
                          {courseCount} courses
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-border-card bg-[linear-gradient(180deg,rgba(11,31,77,0.72),rgba(8,16,36,0.72))] px-4 py-4 shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
              {selectedSemester ? (
                <div className="flex h-full flex-col justify-between gap-5">
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-gold-light">
                          Ready to edit
                        </p>
                        <h3 className="mt-1 text-[1.45rem] font-semibold font-[family-name:var(--font-sora)] text-white">
                          Semester {selectedIndex! + 1}
                        </h3>
                        <p className="mt-1 text-sm text-ink-secondary">
                          {selectedSemester.target_semester || "Auto-selected term"}
                        </p>
                      </div>
                      {selectedSemester.standing_label && (
                        <span className="rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold-light">
                          {selectedSemester.standing_label}
                        </span>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-border-subtle bg-[rgba(7,18,39,0.34)] px-4 py-3">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-ink-faint">
                          Current courses
                        </p>
                        <p className="mt-2 text-2xl font-bold font-[family-name:var(--font-sora)] text-ink-primary">
                          {selectedSemester.recommendations?.length ?? 0}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border-subtle bg-[rgba(7,18,39,0.34)] px-4 py-3">
                        <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-ink-faint">
                          Eligible pool
                        </p>
                        <p className="mt-2 text-2xl font-bold font-[family-name:var(--font-sora)] text-ink-primary">
                          {selectedSemester.eligible_count ?? selectedSemester.recommendations?.length ?? 0}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border-subtle bg-[rgba(7,18,39,0.34)] px-4 py-4">
                      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.24em] text-ink-faint">
                        Preview
                      </p>
                      {previewCodes.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {previewCodes.map((courseCode) => (
                            <span
                              key={courseCode}
                              className="rounded-full border border-[#8ec8ff]/18 bg-[#8ec8ff]/8 px-3 py-1 text-xs font-semibold text-[#8ec8ff]"
                            >
                              {courseCode}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-3 text-sm text-ink-secondary">
                          This semester doesn&apos;t have course recommendations yet.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="ghost" onClick={handleClose}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      variant="gold"
                      onClick={() => {
                        if (selectedIndex === null) return;
                        onEditSemester(selectedIndex);
                      }}
                    >
                      Edit This Semester
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[20rem] flex-col items-center justify-center rounded-2xl border border-dashed border-border-subtle bg-[rgba(7,18,39,0.24)] px-5 text-center">
                  <p className="text-base font-semibold text-ink-primary">Select a semester to begin.</p>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-secondary">
                    We&apos;ll keep this simple: choose a semester from the left, then jump straight into the current course swap editor.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
