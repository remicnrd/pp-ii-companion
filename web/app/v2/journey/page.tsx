"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadDaysIndex, nextUnfinishedDay } from "@/lib/program";
import { vdb } from "@/lib/v2/db";
import { PHASES, arcForDay } from "@/lib/v2/journey";
import type { ProgramDayMeta } from "@/lib/types";
import { Label } from "@/components/v2/ui";

export default function JourneyPage() {
  const [days, setDays] = useState<ProgramDayMeta[]>([]);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [current, setCurrent] = useState(1);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const idx = await loadDaysIndex();
      const progress = await vdb().dayProgress.toArray();
      const done = new Set(progress.filter((p) => p.completedAt).map((p) => p.day));
      setDays(idx.days);
      setCompleted(done);
      setCurrent(nextUnfinishedDay(done, idx.days.length));
      setLoaded(true);
    })();
  }, []);

  if (!loaded) return <div className="px-5 pt-20 text-center" style={{ color: "var(--v2-faint)" }}>…</div>;

  return (
    <div className="max-w-md mx-auto px-5 pt-12">
      <header className="mb-6 v2-rise">
        <Label>The arc</Label>
        <h1 className="text-[26px] font-semibold tracking-tight">How the program builds</h1>
        <p className="text-sm mt-2" style={{ color: "var(--v2-muted)" }}>
          {completed.size} of {days.length} sessions done. Each one installs a shift — they build.
        </p>
      </header>

      <div className="space-y-7">
        {PHASES.map((phase, pi) => (
          <section key={phase.key} className={`v2-rise ${pi < 4 ? `v2-rise-${pi + 1}` : ""}`}>
            <h2 className="text-base font-semibold tracking-tight" style={{ color: "var(--v2-accent)" }}>{phase.title}</h2>
            <p className="text-[13px] leading-relaxed mt-0.5 mb-3" style={{ color: "var(--v2-muted)" }}>{phase.blurb}</p>
            <ol className="relative space-y-2 pl-4" style={{ borderLeft: "1px solid var(--v2-line)" }}>
              {phase.days.map((dayNum) => {
                const meta = days.find((d) => d.day === dayNum);
                const arc = arcForDay(dayNum);
                const isDone = completed.has(dayNum);
                const isCurrent = dayNum === current;
                return (
                  <li key={dayNum} className="relative">
                    <span
                      className="absolute -left-[21px] top-3 w-2.5 h-2.5 rounded-full"
                      style={{
                        background: isDone ? "var(--v2-accent)" : isCurrent ? "var(--v2-ink)" : "var(--v2-faint)",
                        boxShadow: isCurrent && !isDone ? "0 0 0 4px var(--v2-accent-soft)" : undefined,
                      }}
                    />
                    <Link
                      href={`/v2/program/${dayNum}`}
                      className="block rounded-2xl px-3.5 py-3 v2-press"
                      style={{
                        background: isCurrent ? "var(--v2-glass-strong)" : "var(--v2-glass)",
                        border: "1px solid var(--v2-line)",
                      }}
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-[11px] tabular-nums" style={{ color: "var(--v2-faint)" }}>Day {dayNum}</span>
                        {isDone && <span className="text-[11px]" style={{ color: "var(--v2-accent)" }}>✓</span>}
                        {isCurrent && !isDone && <span className="text-[11px]" style={{ color: "var(--v2-ink)" }}>· now</span>}
                      </div>
                      <p className="text-sm font-medium leading-snug mt-0.5">{meta?.title ?? `Day ${dayNum}`}</p>
                      {arc && <p className="text-[12px] leading-relaxed mt-1" style={{ color: "var(--v2-faint)" }}>{arc.paradigm}</p>}
                    </Link>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
