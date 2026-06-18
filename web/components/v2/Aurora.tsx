"use client";

/**
 * The living aurora. Hue + warmth are read from CSS vars on the .v2-root
 * ancestor (set by the v2 layout from the user's thermostat), so the whole
 * scene warms as the transformation progresses.
 */
export function Aurora() {
  return <div className="v2-aurora" aria-hidden />;
}
