"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/shared/Button";
import { Modal } from "@/components/shared/Modal";

interface SavePlanModalProps {
  open: boolean;
  onClose: () => void;
  defaultName: string;
  onSave: (params: { name: string; notes: string }) => void;
  error: string | null;
  disabled?: boolean;
}

export function SavePlanModal({
  open,
  onClose,
  defaultName,
  onSave,
  error,
  disabled = false,
}: SavePlanModalProps) {
  const [name, setName] = useState(defaultName);
  const [notes, setNotes] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(defaultName);
    setNotes("");
  }, [defaultName, open]);

  useEffect(() => {
    if (!open) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [open]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (disabled || !name.trim()) return;
    onSave({ name, notes });
  };

  return (
    <Modal open={open} onClose={onClose} title="Save Plan">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <p className="text-sm text-ink-secondary">
          Save this recommendation set in this browser so you can compare it later.
        </p>

        <div className="space-y-2">
          <label className="text-sm font-medium text-ink-primary">Plan name</label>
          <input
            ref={nameInputRef}
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-xl border border-border-medium bg-surface-input px-3 py-2 text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-gold/40"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-ink-primary">Notes</label>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            className="w-full rounded-xl border border-border-medium bg-surface-input px-3 py-2 text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-gold/40"
            placeholder="Optional context like ‘aggressive summer version’ or ‘double major draft’"
          />
        </div>

        {error && (
          <div className="rounded-xl border border-bad/20 bg-bad-light px-3 py-2 text-sm text-bad">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="gold"
            disabled={disabled || !name.trim()}
          >
            Save
          </Button>
        </div>
      </form>
    </Modal>
  );
}
