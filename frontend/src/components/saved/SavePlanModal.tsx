"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";
import { formatSavedPlanDate } from "@/lib/savedPlanPresentation";
import type { SavePlanMode, SavePlanOverwriteOption, SavePlanSubmitParams } from "@/lib/types";

interface SavePlanModalProps {
  open: boolean;
  onClose: () => void;
  defaultName: string;
  existingPlans: SavePlanOverwriteOption[];
  defaultOverwriteTargetId?: string | null;
  onSave: (params: SavePlanSubmitParams) => void;
  error: string | null;
  disabled?: boolean;
}

export function SavePlanModal({
  open,
  onClose,
  defaultName,
  existingPlans,
  defaultOverwriteTargetId = null,
  onSave,
  error,
  disabled = false,
}: SavePlanModalProps) {
  const [mode, setMode] = useState<SavePlanMode>("create");
  const [targetPlanId, setTargetPlanId] = useState<string | null>(defaultOverwriteTargetId);
  const [name, setName] = useState(defaultName);
  const [notes, setNotes] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);
  const overwriteEnabled = existingPlans.length > 0;
  const selectedOverwritePlan = useMemo(
    () => existingPlans.find((plan) => plan.id === targetPlanId) ?? null,
    [existingPlans, targetPlanId],
  );

  useEffect(() => {
    if (!open) return;
    const nextTargetId = (
      defaultOverwriteTargetId
      && existingPlans.some((plan) => plan.id === defaultOverwriteTargetId)
    )
      ? defaultOverwriteTargetId
      : existingPlans[0]?.id ?? null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset draft fields when modal opens
    setMode("create");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset overwrite selection when modal opens
    setTargetPlanId(nextTargetId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset draft fields when modal opens
    setName(defaultName);
    setNotes("");
  }, [defaultName, defaultOverwriteTargetId, existingPlans, open]);

  useEffect(() => {
    if (!open) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [open]);

  useEffect(() => {
    if (!open || mode !== "overwrite") return;
    if (!overwriteEnabled) {
      setMode("create");
      setTargetPlanId(null);
      setName(defaultName);
      setNotes("");
      return;
    }
    const fallbackTargetId = (
      targetPlanId
      && existingPlans.some((plan) => plan.id === targetPlanId)
    )
      ? targetPlanId
      : existingPlans[0]?.id ?? null;
    if (fallbackTargetId !== targetPlanId) {
      setTargetPlanId(fallbackTargetId);
      return;
    }
    if (selectedOverwritePlan) {
      setName(selectedOverwritePlan.name);
      setNotes(selectedOverwritePlan.notes);
    }
  }, [defaultName, existingPlans, mode, open, overwriteEnabled, selectedOverwritePlan, targetPlanId]);

  const handleModeChange = (nextMode: SavePlanMode) => {
    if (nextMode === "overwrite" && !overwriteEnabled) return;
    setMode(nextMode);
    if (nextMode === "create") {
      setName(defaultName);
      setNotes("");
      return;
    }
    const fallbackTargetId = (
      targetPlanId
      && existingPlans.some((plan) => plan.id === targetPlanId)
    )
      ? targetPlanId
      : existingPlans[0]?.id ?? null;
    setTargetPlanId(fallbackTargetId);
    const overwritePlan = existingPlans.find((plan) => plan.id === fallbackTargetId);
    setName(overwritePlan?.name ?? defaultName);
    setNotes(overwritePlan?.notes ?? "");
  };

  const handleTargetChange = (nextTargetId: string) => {
    setTargetPlanId(nextTargetId);
    const overwritePlan = existingPlans.find((plan) => plan.id === nextTargetId);
    setName(overwritePlan?.name ?? defaultName);
    setNotes(overwritePlan?.notes ?? "");
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || !name.trim()) return;
    if (mode === "overwrite" && !targetPlanId) return;
    onSave({
      mode,
      targetPlanId: mode === "overwrite" ? targetPlanId : null,
      name,
      notes,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Save Plan">
      <form className="relative space-y-5" onSubmit={handleSubmit}>
        <div className="absolute -inset-4 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,rgba(255,204,0,0.05),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(0,114,206,0.06),transparent_50%)]" />
        <p className="relative text-sm text-ink-secondary">
          Save this plan locally so you can compare versions later.
        </p>

        <div className="space-y-2">
          <label className="section-kicker">Save mode</label>
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border-medium bg-surface-input/70 p-1">
            <button
              type="button"
              aria-pressed={mode === "create"}
              onClick={() => handleModeChange("create")}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                mode === "create"
                  ? "bg-gold/20 text-gold border border-gold/30"
                  : "text-ink-secondary hover:bg-surface-hover"
              }`}
            >
              Save as new
            </button>
            <button
              type="button"
              aria-pressed={mode === "overwrite"}
              onClick={() => handleModeChange("overwrite")}
              disabled={!overwriteEnabled}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                mode === "overwrite"
                  ? "bg-gold/20 text-gold border border-gold/30"
                  : "text-ink-secondary hover:bg-surface-hover"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Overwrite existing
            </button>
          </div>
          {!overwriteEnabled && (
            <p className="text-xs text-ink-faint">
              No saved plans are available to overwrite yet.
            </p>
          )}
        </div>

        {mode === "overwrite" && overwriteEnabled && (
          <div className="space-y-3 rounded-2xl border border-border-medium bg-surface-input/40 p-4">
            <div className="space-y-2">
              <label className="section-kicker">Replace this saved plan</label>
              <select
                aria-label="Saved plan to overwrite"
                value={targetPlanId ?? ""}
                onChange={(event) => handleTargetChange(event.target.value)}
                className="w-full rounded-xl border border-border-medium bg-surface-input/80 px-4 py-2.5 text-sm text-ink-primary transition-colors focus:border-gold/30 focus:outline-none focus:ring-2 focus:ring-gold/40"
              >
                {existingPlans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} · Updated {formatSavedPlanDate(plan.updatedAt, { month: "short", day: "numeric" })}
                  </option>
                ))}
              </select>
            </div>

            {selectedOverwritePlan && (
              <div className="rounded-xl border border-border-subtle bg-surface-card/70 px-3 py-3 text-sm text-ink-secondary">
                <p className="font-medium text-ink-primary">{selectedOverwritePlan.name}</p>
                <p className="mt-1 text-xs text-ink-faint">
                  {selectedOverwritePlan.programLine || "Program summary unavailable"} · Target {selectedOverwritePlan.targetSemester} · Updated {formatSavedPlanDate(selectedOverwritePlan.updatedAt)}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label className="section-kicker">Plan name</label>
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-border-medium bg-surface-input/80 px-4 py-2.5 text-sm text-ink-primary transition-colors focus:border-gold/30 focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
        </div>

        <div className="space-y-2">
          <label className="section-kicker">Notes</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            className="w-full rounded-xl border border-border-medium bg-surface-input/80 px-4 py-2.5 text-sm text-ink-primary transition-colors focus:border-gold/30 focus:outline-none focus:ring-2 focus:ring-gold/40"
            placeholder="Optional context like aggressive summer version or double-major draft"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-bad/20 bg-bad-light px-3 py-2 text-sm text-bad">
            {error}
          </div>
        )}

        <div className="divider-fade" />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="gold"
            disabled={disabled || !name.trim() || (mode === "overwrite" && !targetPlanId)}
          >
            {mode === "overwrite" ? "Overwrite plan" : "Save new plan"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
