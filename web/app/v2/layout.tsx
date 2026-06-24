"use client";

import { type ReactNode } from "react";
import { Aurora } from "@/components/v2/Aurora";
import { V2Nav } from "@/components/v2/V2Nav";

/**
 * The aurora's color is fixed (cool indigo). It used to warm as the thermostat
 * rose, but that's intentionally removed — the steady look reads better and the
 * thermostat shouldn't repaint the whole app. Hue/warmth defaults live in the
 * `.v2-root` CSS rule.
 */
export default function V2Layout({ children }: { children: ReactNode }) {
  return (
    <div className="v2-root">
      <Aurora />
      <div className="v2-scroll min-h-[100dvh] pb-28">{children}</div>
      <V2Nav />
    </div>
  );
}
