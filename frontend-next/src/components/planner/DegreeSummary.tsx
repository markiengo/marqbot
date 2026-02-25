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
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-ink-secondary uppercase tracking-wider">
        Degree Summary
      </h3>
      <div className="space-y-2">
        {entries.map(([bid, prog]) => {
          const needed = Number(prog.needed || 0);
          const done = Number(prog.completed_done || 0);
          const inProg = Number(prog.in_progress_increment || 0);
          const label = compactKpiBucketLabel(
            prog.label || bucketLabel(bid, programLabelMap),
          );
          const satisfied = prog.satisfied || (needed > 0 && done >= needed);
          const pct = needed > 0 ? Math.min(100, ((done + inProg) / needed) * 100) : 0;

          return (
            <div key={bid} className={`${satisfied ? "opacity-60" : ""}`}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-ink-secondary truncate mr-2">{label}</span>
                <span className="text-ink-faint shrink-0">
                  {done}
                  {inProg > 0 && `+${inProg}`}/{needed}
                  {satisfied && " \u2713"}
                </span>
              </div>
              <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-ok rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, (done / Math.max(1, needed)) * 100)}%` }}
                />
              </div>
              {inProg > 0 && (
                <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden mt-0.5">
                  <div
                    className="h-full bg-gold rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
