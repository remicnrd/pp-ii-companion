"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Aurora } from "@/components/v2/Aurora";
import { V2Nav } from "@/components/v2/V2Nav";
import { vdb } from "@/lib/v2/db";
import { computeWarmth, hueForWarmth } from "@/lib/v2/selfModel";

export default function V2Layout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [warmth, setWarmth] = useState(0);

  const recompute = useCallback(async () => {
    try {
      const readings = await vdb().thermostat.toArray();
      setWarmth(computeWarmth(readings));
    } catch {
      /* db not ready */
    }
  }, []);

  useEffect(() => {
    recompute();
    const onChange = () => recompute();
    window.addEventListener("v2:selfmodel-changed", onChange);
    return () => window.removeEventListener("v2:selfmodel-changed", onChange);
  }, [recompute, pathname]);

  const hue = hueForWarmth(warmth);

  return (
    <div
      className="v2-root"
      style={
        {
          "--v2-hue": String(hue),
          "--v2-warmth": String(warmth),
        } as React.CSSProperties
      }
    >
      <Aurora />
      <div className="v2-scroll min-h-[100dvh] pb-28">{children}</div>
      <V2Nav />
    </div>
  );
}
