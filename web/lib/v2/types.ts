// v2 data model. The spine is the *self-model* (beliefs, thermostat, values)
// that the program operates on — not the curriculum. All v2 types live here
// and are stored in a SEPARATE database from v1 (see lib/v2/db.ts).

export type Domain =
  | "self"
  | "money"
  | "body"
  | "work"
  | "relationships"
  | "emotions";

export const DOMAINS: { key: Domain; label: string }[] = [
  { key: "self", label: "Identity" },
  { key: "money", label: "Money" },
  { key: "body", label: "Body / Health" },
  { key: "work", label: "Work / Craft" },
  { key: "relationships", label: "Relationships" },
  { key: "emotions", label: "Emotional life" },
];

// Mirrors the NAC arc: you name the limiting belief, build leverage to change
// it, interrupt the old pattern, install the new one, condition it, until it's
// the new default ("installed").
export type BeliefState =
  | "named"
  | "leverage"
  | "interrupted"
  | "conditioning"
  | "installed";

export const BELIEF_STATES: { key: BeliefState; label: string; hint: string }[] = [
  { key: "named", label: "Named", hint: "You've seen it clearly." },
  { key: "leverage", label: "Leverage", hint: "The pain of keeping it is real now." },
  { key: "interrupted", label: "Interrupted", hint: "You've broken the old pattern at least once." },
  { key: "conditioning", label: "Conditioning", hint: "You're rehearsing the new response." },
  { key: "installed", label: "Installed", hint: "The new belief is the default." },
];

export type Belief = {
  id?: number;
  domain: Domain;
  limiting: string;
  empowering: string;
  state: BeliefState;
  sourceDay?: number; // program day that surfaced it
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
};

// "The subconscious thermostat" — what you believe you deserve, per domain.
// 0..100. The aurora warms as the average rises.
export type Thermostat = {
  domain: Domain;
  level: number; // 0..100
  note?: string;
  updatedAt: number;
};

export type CoreValue = {
  id?: number;
  name: string;
  rank: number; // 1 = highest
  rule?: string; // "I feel successful when…"
  createdAt: number;
};

// Daily Priming — Tony Robbins' actual morning Priming practice (~10 min),
// kept faithful to his sequence. Entirely local / zero-AI.
//   1. Breathing — 3 rounds of 30 breaths
//   2. Gratitude — 3 things, felt fully in the body (not just thought)
//   3. Strengthen / blessing — draw in healing energy, then send it to others
//   4. Three to Thrive — 3 outcomes seen, felt, and celebrated as already done
export type PrimingEntry = {
  date: string; // YYYY-MM-DD (one per day)
  breathRounds: number; // rounds of 30 breaths completed (0..3)
  gratitude: string[]; // 3 things, fully felt
  blessing: string; // who/what you sent strength to
  threeToThrive: string[]; // 3 outcomes experienced as already accomplished
  completedAt: number;
};

// v2 day progress — the day as an *operation on the self-model*.
// The NAC loop is captured as discrete, deterministic steps (zero-AI).
export type NacWork = {
  outcome: string; // what you actually want here
  block: string; // what's stopping you
  leverage: string; // cost of not changing / reward of changing
  newPattern: string; // the empowering alternative
  test: string; // how you'll test it this week
};

export type DayProgressV2 = {
  day: number;
  audioPlayedAt?: number;
  nac: Partial<NacWork>;
  completedAt?: number;
  updatedAt: number;
};

export type CoachMessageV2 = {
  id?: number;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
};

export type V2Settings = {
  id: "default";
  apiKey?: string;
  baseURL?: string;
  model?: string;
  startDate?: string;
  intentName?: string; // what the user calls the change they're after
};
