"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Today", icon: "●" },
  { href: "/program", label: "Program", icon: "▤" },
  { href: "/momentum", label: "Momentum", icon: "↗" },
  { href: "/coach", label: "Coach", icon: "✦" },
  { href: "/setup", label: "Setup", icon: "⚙" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-page/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]">
      <ul className="flex justify-around max-w-2xl mx-auto px-2">
        {items.map((it) => {
          const active =
            it.href === "/"
              ? pathname === "/"
              : pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] tracking-wide ${
                  active ? "text-ink" : "text-faint"
                }`}
              >
                <span className="text-base leading-none">{it.icon}</span>
                <span>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
