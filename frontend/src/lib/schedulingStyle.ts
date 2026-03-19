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
    helper: "Lock in. Core and major classes first, discovery later.",
    detail: "Prioritizes business core and major requirements. Discovery only fills in when core slots are full. The fastest path to finishing your major.",
    isDefault: true,
  },
  {
    value: "explorer",
    label: "Explorer",
    helper: "Side quest mode. Gen-eds and discovery early, major stuff later.",
    detail: "Reserves two slots each semester for discovery and gen-eds so you can explore before committing to the major grind. Core prereqs still happen on time.",
    isDefault: false,
  },
  {
    value: "mixer",
    label: "Mixer",
    helper: "A little of everything. Keeps each semester balanced.",
    detail: "Alternates between core and discovery picks so every semester has variety. At least one discovery course and two core courses guaranteed.",
    isDefault: false,
  },
];
