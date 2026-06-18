// The transformational arc, authored from the program's structure. This is the
// throughline the v1 app never showed: each session installs a paradigm, and
// they build on each other. Purely static content — no AI, no fetch.

export type Phase = {
  key: string;
  title: string;
  blurb: string;
  days: number[];
};

export type DayArc = {
  day: number;
  phase: string; // Phase.key
  // The identity/paradigm shift this session is really asking for.
  paradigm: string;
};

export const PHASES: Phase[] = [
  {
    key: "decide",
    title: "I. Decide",
    blurb: "Power is the ability to act. It starts with a real decision — and the belief that your past doesn't set your ceiling.",
    days: [1],
  },
  {
    key: "force",
    title: "II. The Controlling Force",
    blurb: "Everything you do is driven by what you link pain and pleasure to. Change the associations and behavior follows — that's the mechanism (NAC).",
    days: [2, 3, 4],
  },
  {
    key: "states",
    title: "III. Master Your States",
    blurb: "You don't act on reality — you act on the state you're in. Learn to change focus and emotion on demand.",
    days: [5, 6],
  },
  {
    key: "source",
    title: "IV. Rewrite the Source",
    blurb: "Values and beliefs decide what everything means. This is where identity actually lives.",
    days: [7, 8, 9],
  },
  {
    key: "design",
    title: "V. Design & Condition",
    blurb: "Aim the engine: set compelling goals, then make the new self automatic through rituals and anchoring.",
    days: [10, 11, 12],
  },
  {
    key: "money",
    title: "VI. Money",
    blurb: "Raise the financial thermostat and end the self-sabotage that quietly resets it.",
    days: [13, 14],
  },
  {
    key: "free",
    title: "VII. Free Yourself",
    blurb: "Dissolve the fears and patterns that cap you, and rebuild the energy to sustain the new identity.",
    days: [15, 16, 17],
  },
  {
    key: "expand",
    title: "VIII. Expand",
    blurb: "Take it outward — into relationships and the speed at which you solve problems.",
    days: [18, 19],
  },
  {
    key: "challenge",
    title: "IX. The Challenge",
    blurb: "Live it. The program ends; the conditioning is yours to keep running.",
    days: [20],
  },
];

export const DAY_ARC: DayArc[] = [
  { day: 1, phase: "decide", paradigm: "My past does not equal my future. Power is the ability to act — and I decide now." },
  { day: 2, phase: "force", paradigm: "I don't lack willpower — I've linked pain and pleasure to the wrong things." },
  { day: 3, phase: "force", paradigm: "Events are neutral. The meaning I assign — my neuro-association — is what runs me." },
  { day: 4, phase: "force", paradigm: "I can deliberately recondition those associations. Change is a skill, not a mood." },
  { day: 5, phase: "states", paradigm: "What I chase is really a state. I can create the state directly." },
  { day: 6, phase: "states", paradigm: "What I focus on, I feel. My questions steer my focus." },
  { day: 7, phase: "source", paradigm: "My values silently decide every choice. I can choose them on purpose." },
  { day: 8, phase: "source", paradigm: "I take responsibility for the meaning — that's where control actually is." },
  { day: 9, phase: "source", paradigm: "Beliefs are the source of success or failure. Mine are editable." },
  { day: 10, phase: "design", paradigm: "A compelling future pulls me forward harder than willpower pushes." },
  { day: 11, phase: "design", paradigm: "Who I become is built by daily rituals, not occasional intensity." },
  { day: 12, phase: "design", paradigm: "I can anchor a resourceful state and fire it on command." },
  { day: 13, phase: "money", paradigm: "My income tracks my identity. I can raise what I believe I deserve." },
  { day: 14, phase: "money", paradigm: "I'll name and disarm the pattern that resets me to broke." },
  { day: 15, phase: "free", paradigm: "Fear of failure and of success are just associations I can rewire." },
  { day: 16, phase: "free", paradigm: "Self-sabotage is an old protection. I can retire it." },
  { day: 17, phase: "free", paradigm: "Energy is the carrier of the new identity. I'll protect and build it." },
  { day: 18, phase: "expand", paradigm: "Relationships run on the same pain/pleasure rules — I can lead them consciously." },
  { day: 19, phase: "expand", paradigm: "Problems shrink to the quality of the questions I ask about them." },
  { day: 20, phase: "challenge", paradigm: "The tools are mine now. I run the conditioning for life." },
];

export function arcForDay(day: number): DayArc | undefined {
  return DAY_ARC.find((d) => d.day === day);
}
export function phaseByKey(key: string): Phase | undefined {
  return PHASES.find((p) => p.key === key);
}
