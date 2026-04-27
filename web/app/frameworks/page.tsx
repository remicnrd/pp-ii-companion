"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadFrameworks } from "@/lib/program";
import type { FrameworksIndex } from "@/lib/types";

export default function FrameworksPage() {
  const [data, setData] = useState<FrameworksIndex | null>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    (async () => setData(await loadFrameworks()))();
  }, []);

  if (!data) return <div className="p-6 text-faint">Loading…</div>;

  const filtered = data.frameworks.filter((f) => {
    if (!query.trim()) return true;
    const hay = (f.name + " " + f.description + " " + f.steps.map((s) => s.name + s.detail).join(" ")).toLowerCase();
    return hay.includes(query.toLowerCase());
  });

  return (
    <div className="max-w-2xl mx-auto px-5 pt-10 pb-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-faint mb-2">Frameworks</p>
        <h1 className="text-3xl font-semibold tracking-tight">Library</h1>
        <p className="text-sm text-muted mt-2">
          Every named framework from the program — searchable, reusable.
        </p>
      </header>

      <input
        type="search"
        placeholder="Search frameworks…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full bg-page border border-line rounded-lg px-3 py-2.5 text-sm mb-6 focus:outline-none focus:border-ink/30"
      />

      <ul className="space-y-2">
        {filtered.map((f, i) => {
          const open = openId === i;
          return (
            <li key={i} className="rounded-xl border border-line bg-elevate-soft overflow-hidden">
              <button
                onClick={() => setOpenId(open ? null : i)}
                className="w-full text-left p-4 hover:bg-elevate transition"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-semibold leading-snug">{f.name}</h3>
                  <span className="text-[10px] uppercase tracking-widest text-faint shrink-0">
                    Day {f.introduced_day}
                  </span>
                </div>
                {!open && (
                  <p className="text-sm text-muted mt-1 leading-relaxed line-clamp-2">{f.description}</p>
                )}
              </button>
              {open && (
                <div className="px-4 pb-4 border-t border-line pt-3">
                  <p className="text-sm text-muted mb-3 leading-relaxed">{f.description}</p>
                  <ol className="space-y-2 mb-3">
                    {f.steps.map((s, j) => (
                      <li key={j} className="text-sm">
                        <span className="text-faint mr-2">{j + 1}.</span>
                        <span className="font-semibold">{s.name}</span>
                        <span className="text-muted"> — {s.detail}</span>
                      </li>
                    ))}
                  </ol>
                  <Link
                    href={`/program/${f.introduced_day}`}
                    className="text-xs text-faint hover:text-ink"
                  >
                    Open Day {f.introduced_day} →
                  </Link>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
