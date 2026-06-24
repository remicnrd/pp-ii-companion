import type { Belief } from "./types";

export function todayISO(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Consecutive-day streak ending today (or yesterday, so a not-yet-done-today
 * streak still counts until the day is over). Works for any list of ISO dates.
 */
export function streakFromDates(dates: string[], today = new Date()): number {
  if (!dates.length) return 0;
  const set = new Set(dates);
  let streak = 0;
  const d = new Date(today);
  if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1);
  for (;;) {
    const iso = d.toISOString().slice(0, 10);
    if (set.has(iso)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else break;
  }
  return streak;
}

/** All distinct dates the user conditioned ANY belief — the "showed up" streak. */
export function conditioningDates(beliefs: Belief[]): string[] {
  const all = new Set<string>();
  for (const b of beliefs) for (const d of b.conditionedDates ?? []) all.add(d);
  return [...all];
}

export function conditionedOn(b: Belief, iso: string): boolean {
  return (b.conditionedDates ?? []).includes(iso);
}
