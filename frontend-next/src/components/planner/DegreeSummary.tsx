import type { BucketProgress } from "@/lib/types";
import { sortProgressEntries, compactKpiBucketLabel } from "@/lib/rendering";
import { bucketLabel } from "@/lib/utils";

interface DegreeSummaryProps {
  currentProgress: Record<string, BucketProgress>;
  programLabelMap?: Map<string, string>;
}

export function DegreeSummary({ currentProgress, programLabelMap }: DegreeSummaryProps) {
  if (!currentProgress || !Object.keys(currentProgress).length) return null;

  const entries = sortProgressEntries(currentProgress);

  return (
    <div className="h-full min-h-0 rounded-2xl border border-border-subtle bg-gradient-to-br from-[#0f2a52]/70 to-[#10284a]/55 p-3 flex flex-col">
      <h3 className="text-2xl font-bold font-[family-name:var(--font-sora)] text-gold uppercase tracking-wide px-1 pb-2">
        Degree Summary
      </h3>

      <div className="rounded-xl border border-border-subtle bg-[#0b2143]/70 flex-1 min-h-0 overflow-y-auto">
        {entries.map(([bid, prog]) => {
          const needed = Number(prog.needed || 0);
          const done = Number(prog.completed_done || prog.done_count || 0);
          const inProg = Number(prog.in_progress_increment || 0);
          const label = compactKpiBucketLabel(
            prog.label || bucketLabel(bid, programLabelMap),
          );
          const satisfied = prog.satisfied || (needed > 0 && done >= needed);
          const highlightBcc = bid.includes("BCC_REQUIRED");

          return (
            <div
              key={bid}
              className="flex items-center justify-between gap-2 px-3 py-2 border-b border-border-subtle/40 last:border-b-0"
            >
              <span
                className={`text-base leading-tight ${
                  highlightBcc
                    ? "text-gold font-semibold"
                    : satisfied
                      ? "text-ink-faint"
                      : "text-ink-secondary"
                }`}
              >
                {label}
              </span>
              <span className="text-base shrink-0 text-ink-faint">
                {done}
                {inProg > 0 && <span className="text-gold">+{inProg}</span>}/{needed}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
