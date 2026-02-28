import type { BucketProgress } from "@/lib/types";
import { groupProgressByParent, compactKpiBucketLabel, getBucketDisplay } from "@/lib/rendering";
import { bucketLabel } from "@/lib/utils";

interface DegreeSummaryProps {
  currentProgress: Record<string, BucketProgress>;
  programLabelMap?: Map<string, string>;
}

export function DegreeSummary({ currentProgress, programLabelMap }: DegreeSummaryProps) {
  if (!currentProgress || !Object.keys(currentProgress).length) return null;

  const groups = groupProgressByParent(currentProgress, programLabelMap);

  return (
    <div className="h-full min-h-0 rounded-2xl border border-border-subtle bg-gradient-to-br from-[#0f2a52]/70 to-[#10284a]/55 p-2 flex flex-col">
      <h3 className="text-base md:text-lg font-bold font-[family-name:var(--font-sora)] text-gold uppercase tracking-wide px-1 pb-1">
        Degree Summary
      </h3>

      <div className="flex-1 min-h-0 overflow-y-auto pb-2">
        {groups.map((group) => (
          <div key={group.parentId}>
            <div className="px-2 pt-2 pb-0.5">
              <span className="text-[10px] font-semibold text-gold/60 uppercase tracking-widest leading-none">
                {group.label}
              </span>
            </div>
            {group.entries.map(([bid, prog]) => {
              const { done, inProg, needed, unit } = getBucketDisplay(prog);
              const label = compactKpiBucketLabel(
                prog.label || bucketLabel(bid, programLabelMap),
              );
              const satisfied = prog.satisfied || (Number(prog.needed || 0) > 0 && Number(prog.completed_done ?? prog.done_count ?? 0) >= Number(prog.needed || 0));
              const highlightBcc = bid.includes("BCC_REQUIRED");

              return (
                <div
                  key={bid}
                  className="flex items-center justify-between gap-2 pl-4 pr-2 py-1.5 border-b border-border-subtle/40 last:border-b-0"
                >
                  <span
                    className={`text-[13px] leading-tight ${
                      highlightBcc
                        ? "text-gold font-semibold"
                        : satisfied
                          ? "text-ok"
                          : "text-ink-secondary"
                    }`}
                  >
                    {label}
                  </span>
                  <span className="text-[13px] shrink-0 text-ink-faint">
                    {done}
                    {inProg > 0 && <span className="text-gold">+{inProg}</span>}/{needed} {unit}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
