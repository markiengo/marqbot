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
    helper: "Declared program work first. MCC and gen-ed cleanup gets pushed late.",
    detail:
      "Front-loads your declared major and track path, keeps only truly critical business-core gateways near the front, and shoves CORE 1929 / CORE 4929 style cleanup to the tail. Pick this when you want the most locked-in, no-summer grinder plan.",
    isDefault: true,
  },
  {
    value: "explorer",
    label: "Explorer",
    helper: "Discovery and gen-eds earlier. Good if you're still figuring things out.",
    detail:
      "Reserves two slots each semester for discovery and gen-ed courses so you can explore interests before locking into the major grind. Core prereqs still happen on time - you won't fall behind.",
    isDefault: false,
  },
  {
    value: "mixer",
    label: "Mixer",
    helper: "Balanced semesters. A bit of core, a bit of discovery every term.",
    detail:
      "Alternates between core and discovery picks so every semester has variety. Guarantees at least one discovery course and two core courses per term. A good middle ground if you want steady progress without all-core semesters.",
    isDefault: false,
  },
];
