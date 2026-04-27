"use client";

import { type ReactNode } from "react";

/**
 * Collapsible section with a bold header and a chevron.
 * Uses native <details> for keyboard + a11y, no JS state needed.
 */
export function Section({
  title,
  count,
  defaultOpen = true,
  children,
}: {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  return (
    <details
      open={defaultOpen}
      className="rounded-2xl border border-line bg-elevate-soft mb-4 overflow-hidden"
    >
      <summary className="flex items-baseline gap-2 px-4 py-3 text-sm font-semibold tracking-tight">
        <span className="chev text-faint text-xs leading-none">▶</span>
        <span className="uppercase tracking-widest text-[11px]">{title}</span>
        {typeof count === "number" && (
          <span className="text-faint text-[11px]">({count})</span>
        )}
      </summary>
      <div className="px-4 pb-4 pt-1 border-t border-line">{children}</div>
    </details>
  );
}
