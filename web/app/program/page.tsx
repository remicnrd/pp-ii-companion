"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadDaysIndex, expectedDayOnDate } from "@/lib/program";
import { db, getSettings } from "@/lib/db";
import type { ProgramDayMeta } from "@/lib/types";

export default function ProgramListPage() {
  const [days, setDays] = useState<ProgramDayMeta[]>([]);
  const [completed, setCompleted] = useState<Record<number, boolean>>({});
  const [todayDay, setTodayDay] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const idx = await loadDaysIndex();
      setDays(idx.days);
      const all = await db().dayProgress.toArray();
      const map: Record<number, boolean> = {};
      for (const p of all) if (p.completedAt) map[p.day] = true;
      setCompleted(map);
      const s = await getSettings();
      if (s.startDate) setTodayDay(expectedDayOnDate(s.startDate));
    })();
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-5 pt-10 pb-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-faint mb-2">Program</p>
        <h1 className="text-3xl font-semibold tracking-tight">All sessions</h1>
      </header>

      <ul className="space-y-2">
        {days.map((d) => {
          const isToday = todayDay === d.day;
          const isDone = completed[d.day];
          return (
            <li key={d.day}>
              <Link
                href={`/program/${d.day}`}
                className={`block rounded-xl border p-4 transition ${
                  isToday
                    ? "border-warn-line bg-warn-bg hover:opacity-90"
                    : "border-line bg-elevate-soft hover:bg-elevate"
                }`}
              >
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <p className="text-xs uppercase tracking-widest text-faint">
                    Day {d.day}
                    {d.covers.length > 1 && ` · covers ${d.covers[0]}–${d.covers[d.covers.length - 1]}`}
                  </p>
                  {isToday && <span className="text-[10px] uppercase tracking-widest text-warn-ink font-semibold">Today</span>}
                  {isDone && <span className="text-[10px] uppercase tracking-widest text-ok font-semibold">Done</span>}
                </div>
                <p className="font-semibold leading-snug">{d.title}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
