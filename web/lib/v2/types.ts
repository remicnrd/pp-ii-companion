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

// Kept as a vestigial field on Belief (always "named" now). The old 5-stage
// "advance" tracker was removed — it was self-reported busywork, not real signal.
export type BeliefState = "named";

export type Belief = {
  id?: number;
  domain: Domain;
  limiting: string;
  empowering: string;
  state: BeliefState;
  sourceDay?: number; // program day that surfaced it
  /** ISO dates (YYYY-MM-DD) the user conditioned this belief — the daily NAC reps. */
  conditionedDates?: string[];
  createdAt: number;
  updatedAt: number;
  archivedAt?: number;
};

// Tony's "subconscious thermostat": the setpoint for what you'll let yourself
// have in an area. Exceed it and you self-sabotage back down to it; only
// conditioning moves the setpoint for real (willpower snaps back). So this isn't
// a slider with a number — it's awareness of the gap (where it is vs where it
// should be) plus the daily practice that actually resets it.
export type ThermostatArea = {
  id?: number;
  area: string; // the area that matters, in your words (Money, Health, …)
  current: string; // where the setpoint sits now, honestly
  target: string; // where it needs to be
  conditioning?: string; // the practice that raises it — so you don't forget to do it
  createdAt: number;
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

// A holistic, substantive read of the user's self-model from the coach — big
// picture (are these the right things, well organized?) plus a per-belief verdict.
export type BeliefVerdict = {
  id: number;
  verdict: "solid" | "reconsider";
  note: string;
};
export type SelfReview = {
  overall: string;
  beliefs: BeliefVerdict[];
  generatedAt: number;
};

export type V2Settings = {
  id: "default";
  apiKey?: string;
  baseURL?: string;
  model?: string;
  startDate?: string;
  intentName?: string; // what the user calls the change they're after
  review?: SelfReview; // last coach review of the self-model
};
