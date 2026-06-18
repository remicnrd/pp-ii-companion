import type { Belief, BeliefState, Thermostat } from "./types";
import { BELIEF_STATES } from "./types";

export function todayISO(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Average thermostat 0..1 across whatever domains have readings. */
export function computeWarmth(readings: Thermostat[]): number {
  if (!readings.length) return 0;
  const avg = readings.reduce((s, r) => s + r.level, 0) / readings.length;
  return Math.max(0, Math.min(1, avg / 100));
}

/** Map warmth → aurora hue. Cool indigo (250) when low, amber (40) when high. */
export function hueForWarmth(warmth: number): number {
  return Math.round(250 - warmth * 210);
}

export function beliefStateIndex(state: BeliefState): number {
  return BELIEF_STATES.findIndex((s) => s.key === state);
}

export function beliefStateMeta(state: BeliefState) {
  return BELIEF_STATES.find((s) => s.key === state) ?? BELIEF_STATES[0];
}

/** Overall transformation progress 0..1 from beliefs moving toward "installed". */
export function transformationProgress(beliefs: Belief[]): number {
  const live = beliefs.filter((b) => !b.archivedAt);
  if (!live.length) return 0;
  const max = (BELIEF_STATES.length - 1) * live.length;
  const got = live.reduce((s, b) => s + beliefStateIndex(b.state), 0);
  return max ? got / max : 0;
}
