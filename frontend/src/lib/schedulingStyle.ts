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
    detail: "Knocks out business core and major requirements first. Discovery fills in around the edges. The prereq chain runs the show and you run with it.",
    isDefault: true,
  },
  {
    value: "explorer",
    label: "Explorer",
    helper: "Side quest mode. Gen-eds and discovery early, major stuff later.",
    detail: "Front-loads discovery and gen-eds so you can figure out what you actually like before committing to the major grind. Core prereqs still happen on time — the system is not going to let you drift.",
    isDefault: false,
  },
  {
    value: "mixer",
    label: "Mixer",
    helper: "A little of everything. Keeps each semester balanced.",
    detail: "Mixes gen-eds into your schedule alongside core and major classes. No semester is all-business or all-exploration. Lowkey the chill option.",
    isDefault: false,
  },
];
