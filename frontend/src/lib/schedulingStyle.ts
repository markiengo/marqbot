export type SchedulingStyle = "grinder" | "explorer" | "mixer";

export const SCHEDULING_STYLE_OPTIONS: {
  value: SchedulingStyle;
  label: string;
  helper: string;
  detail: string;
  isDefault?: boolean;
}[] = [
  {
    value: "grinder",
    label: "Grinder",
    helper: "Core and major requirements first. Best for internship readiness.",
    detail: "Prioritizes business core and major requirements so you hit key milestones early. Discovery fills in once core slots are covered. Most students pick this — it\u2019s the fastest path to internship eligibility and major completion.",
    isDefault: true,
  },
  {
    value: "explorer",
    label: "Explorer",
    helper: "Discovery and gen-eds earlier. Good if you\u2019re still figuring things out.",
    detail: "Reserves two slots each semester for discovery and gen-ed courses so you can explore interests before locking into the major grind. Core prereqs still happen on time — you won\u2019t fall behind.",
    isDefault: false,
  },
  {
    value: "mixer",
    label: "Mixer",
    helper: "Balanced semesters. A bit of core, a bit of discovery every term.",
    detail: "Alternates between core and discovery picks so every semester has variety. Guarantees at least one discovery course and two core courses per term. A good middle ground if you want steady progress without all-core semesters.",
    isDefault: false,
  },
];
