"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "@/components/shared/Modal";
import { Button } from "@/components/shared/Button";
import { useAppContext } from "@/context/AppContext";
import { postFeedback } from "@/lib/api";
import {
  buildFeedbackPayload,
  FEEDBACK_MAX_MESSAGE_LENGTH,
  getFeedbackMessageError,
} from "@/lib/feedback";

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}

const RATING_OPTIONS = [
  { value: 1, label: "1", hint: "rough" },
  { value: 2, label: "2", hint: "shaky" },
  { value: 3, label: "3", hint: "solid" },
  { value: 4, label: "4", hint: "great" },
  { value: 5, label: "5", hint: "clutch" },
] as const;

export function FeedbackModal({ open, onClose, onSubmitted }: FeedbackModalProps) {
  const pathname = usePathname();
  const { state } = useAppContext();
  const [rating, setRating] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRating(null);
    setMessage("");
    setSubmitError(null);
    setSubmitting(false);
  }, [open]);

  const messageError = useMemo(() => getFeedbackMessageError(message), [message]);
  const remaining = FEEDBACK_MAX_MESSAGE_LENGTH - message.length;
  const canSubmit = !submitting && rating !== null && messageError === null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || rating === null) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = buildFeedbackPayload(state, pathname || "/planner", rating, message);
      await postFeedback(payload);
      onClose();
      onSubmitted();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not send feedback.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Send feedback">
      <form className="relative space-y-6" onSubmit={handleSubmit}>
        <div className="absolute -inset-4 pointer-events-none bg-[radial-gradient(ellipse_at_top_left,rgba(255,204,0,0.07),transparent_52%),radial-gradient(ellipse_at_bottom_right,rgba(0,114,206,0.08),transparent_52%)]" />

        <div className="relative space-y-2">
          <p className="section-kicker">Straight from the planner</p>
          <p className="text-sm leading-relaxed text-ink-secondary">
            Rate the app and tell me what happened. Bugs, confusing copy, missing features, and ugly edge cases all belong here.
          </p>
        </div>

        <div className="relative space-y-3">
          <label className="section-kicker">How did this feel?</label>
          <div className="grid grid-cols-5 gap-2">
            {RATING_OPTIONS.map((option) => {
              const active = rating === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setRating(option.value)}
                  aria-pressed={active}
                  aria-label={`Rate MarqBot ${option.value} out of 5`}
                  className={`rounded-2xl border px-2 py-3 text-center transition-all ${
                    active
                      ? "border-gold/55 bg-gold/14 text-gold shadow-[0_0_24px_rgba(255,204,0,0.14)]"
                      : "border-border-medium bg-surface-input/70 text-ink-secondary hover:border-gold/25 hover:text-ink-primary"
                  }`}
                >
                  <div className="font-[family-name:var(--font-sora)] text-lg font-semibold">{option.label}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.16em]">{option.hint}</div>
                </button>
              );
            })}
          </div>
          {rating === null && (
            <p className="text-xs text-ink-faint">Pick a rating so I can sort signal from venting.</p>
          )}
        </div>

        <div className="relative space-y-2">
          <label htmlFor="feedback-message" className="section-kicker">
            What should I know?
          </label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={6}
            maxLength={FEEDBACK_MAX_MESSAGE_LENGTH}
            placeholder="Example: the warnings felt confusing after I added a double major, or the semester recs looked wrong after I marked ACCO 1001 in progress."
            className="w-full rounded-2xl border border-border-medium bg-surface-input/80 px-4 py-3 text-sm leading-relaxed text-ink-primary transition-colors focus:border-gold/30 focus:outline-none focus:ring-2 focus:ring-gold/35"
          />
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className={messageError ? "text-bad" : "text-ink-faint"}>
              {messageError || "Your current planner setup and latest recommendation snapshot will be attached."}
            </span>
            <span className={remaining < 160 ? "text-ink-secondary" : "text-ink-faint"}>
              {remaining}
            </span>
          </div>
        </div>

        {submitError && (
          <div className="rounded-xl border border-bad/20 bg-bad-light px-3 py-2 text-sm text-bad">
            {submitError}
          </div>
        )}

        <div className="divider-fade" />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="gold" disabled={!canSubmit}>
            {submitting ? "Sending..." : "Send feedback"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
