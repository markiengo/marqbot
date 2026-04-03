import type { ProgramBucketTree } from "./types";

const MCC_PROGRAM_ORDER = new Map<string, number>([
  ["MCC_FOUNDATION", 0],
  ["MCC_DISC", 1],
  ["MCC_ESSV2", 2],
  ["MCC_WRIT", 3],
  ["MCC_CULM", 4],
]);

function bucketMapProgramGroupRank(program: ProgramBucketTree): number {
  const id = String(program.program_id || "").trim().toUpperCase();
  if (id.startsWith("MCC")) return 0;
  if (id.startsWith("BCC")) return 1;
  if (program.type === "major") return 2;
  if (program.type === "track") return 3;
  if (program.type === "minor") return 4;
  return 5;
}

function bucketMapProgramWithinGroupRank(program: ProgramBucketTree): number {
  const id = String(program.program_id || "").trim().toUpperCase();
  if (id.startsWith("MCC")) return MCC_PROGRAM_ORDER.get(id) ?? 99;
  if (id.startsWith("BCC")) return 0;
  return 0;
}

export function sortProgramsForBucketMap(programs: ProgramBucketTree[]): ProgramBucketTree[] {
  return programs
    .map((program, index) => ({ program, index }))
    .sort((a, b) => {
      const groupRankDiff =
        bucketMapProgramGroupRank(a.program) - bucketMapProgramGroupRank(b.program);
      if (groupRankDiff !== 0) return groupRankDiff;

      const withinGroupDiff =
        bucketMapProgramWithinGroupRank(a.program) - bucketMapProgramWithinGroupRank(b.program);
      if (withinGroupDiff !== 0) return withinGroupDiff;

      return a.index - b.index;
    })
    .map(({ program }) => program);
}
