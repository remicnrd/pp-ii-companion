"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { seg: "", label: "Today", icon: "◎" },
  { seg: "journey", label: "Journey", icon: "↗" },
  { seg: "you", label: "You", icon: "✶" },
  { seg: "coach", label: "Coach", icon: "✦" },
];

export function V2Nav() {
  // usePathname() returns the route WITHOUT basePath; <Link> adds basePath itself.
  const pathname = usePathname();
  const rel = pathname.replace(/\/$/, "").replace(/^\/v2/, "").replace(/^\//, "");
  const activeSeg = rel.split("/")[0] ?? "";

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 pb-[env(safe-area-inset-bottom)]"
      style={{
        background: "rgba(7,7,11,0.6)",
        backdropFilter: "blur(22px) saturate(140%)",
        WebkitBackdropFilter: "blur(22px) saturate(140%)",
        borderTop: "1px solid var(--v2-line)",
      }}
    >
      <ul className="flex justify-around max-w-md mx-auto px-2">
        {items.map((it) => {
          const active = activeSeg === it.seg;
          return (
            <li key={it.seg || "today"} className="flex-1">
              <Link
                href={`/v2${it.seg ? "/" + it.seg : ""}`}
                className="v2-press flex flex-col items-center gap-1 py-2.5 text-[10px] tracking-wide"
                style={{ color: active ? "var(--v2-accent)" : "var(--v2-faint)" }}
              >
                <span className="text-lg leading-none">{it.icon}</span>
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
