"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadDaysIndex, nextUnfinishedDay } from "@/lib/program";
import { vdb, getV2Settings } from "@/lib/v2/db";
import { arcForDay } from "@/lib/v2/journey";
import { todayISO } from "@/lib/v2/selfModel";
import type { ProgramDayMeta } from "@/lib/types";
import type { Belief, V2Settings } from "@/lib/v2/types";
import { Card, Label } from "@/components/v2/ui";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function V2Today() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<V2Settings | null>(null);
  const [day, setDay] = useState<ProgramDayMeta | null>(null);
  const [primedToday, setPrimedToday] = useState(false);
  const [primeStreak, setPrimeStreak] = useState(0);
  const [beliefs, setBeliefs] = useState<Belief[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalDays, setTotalDays] = useState(20);

  useEffect(() => {
    (async () => {
      const s = await getV2Settings();
      const idx = await loadDaysIndex();
      const progress = await vdb().dayProgress.toArray();
      const completed = new Set(progress.filter((p) => p.completedAt).map((p) => p.day));
      const dayNum = nextUnfinishedDay(completed, idx.days.length);
      const allBeliefs = (await vdb().beliefs.toArray()).filter((b) => !b.archivedAt);
      const primingDates = (await vdb().priming.toArray()).map((p) => p.date).sort();

      setSettings(s);
      setDay(idx.days.find((d) => d.day === dayNum) ?? null);
      setCompletedCount(completed.size);
      setTotalDays(idx.days.length);
      setBeliefs(allBeliefs);
      setPrimedToday(primingDates.includes(todayISO()));
      setPrimeStreak(computeStreak(primingDates));
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="px-5 pt-20 text-center" style={{ color: "var(--v2-faint)" }}>…</div>;
  }

  const sessionPct = totalDays ? Math.round((completedCount / totalDays) * 100) : 0;
  const arc = day ? arcForDay(day.day) : undefined;
  const conditioning = beliefs.slice(0, 3);

  return (
    <div className="max-w-md mx-auto px-5 pt-12">
      <header className="mb-7 v2-rise">
        <h1 className="text-[28px] font-semibold tracking-tight leading-tight">{greeting()}.</h1>
        {settings?.intentName && (
          <p className="text-sm mt-1.5" style={{ color: "var(--v2-muted)" }}>
            Working toward <span style={{ color: "var(--v2-accent)" }}>{settings.intentName}</span>.
          </p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div className="h-full rounded-full" style={{ width: `${Math.max(4, sessionPct)}%`, background: "var(--v2-accent)", transition: "width .6s ease" }} />
          </div>
          <span className="text-xs" style={{ color: "var(--v2-faint)" }}>{completedCount}/{totalDays} sessions</span>
        </div>
      </header>

      {/* Priming — the daily ritual */}
      <Link href="/v2/priming" className="block mb-4 v2-rise v2-rise-2">
        <Card className="p-5 v2-press">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Daily priming · ~10 min</Label>
              <p className="text-lg font-semibold mt-0.5">
                {primedToday ? "Primed for today" : "Begin today's priming"}
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--v2-muted)" }}>
                {primedToday
                  ? "The state is set. Carry it."
                  : "Breathe, feel gratitude, send strength, see three wins as done."}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl">{primedToday ? "✓" : "◎"}</div>
              {primeStreak > 0 && (
                <div className="text-xs mt-1" style={{ color: "var(--v2-accent)" }}>{primeStreak}-day streak</div>
              )}
            </div>
          </div>
        </Card>
      </Link>

      {/* Today's session */}
      {day && (
        <Link href={`/v2/program/${day.day}`} className="block mb-4 v2-rise v2-rise-3">
          <Card className="p-5 v2-press">
            <Label>
              {completedCount >= 20 ? "Revisit · " : "Today's session · "}Day {day.day}
              {day.covers.length > 1 && ` · Tony days ${day.covers[0]}–${day.covers[day.covers.length - 1]}`}
            </Label>
            <p className="text-xl font-semibold leading-snug mt-0.5">{day.title}</p>
            {arc && (
              <p className="text-sm mt-2 leading-relaxed" style={{ color: "var(--v2-muted)" }}>
                {arc.paradigm}
              </p>
            )}
            <p className="text-xs mt-3" style={{ color: "var(--v2-accent)" }}>Open the session →</p>
          </Card>
        </Link>
      )}

      {/* What you're working on */}
      <div className="v2-rise v2-rise-4">
        <Link href="/v2/you" className="block">
          <Card className="p-5 v2-press">
            <Label>Beliefs you're changing</Label>
            {conditioning.length === 0 ? (
              <p className="text-sm mt-1" style={{ color: "var(--v2-muted)" }}>
                Nothing named yet. A session will surface your first belief — or add one in You.
              </p>
            ) : (
              <ul className="mt-2 space-y-2.5">
                {conditioning.map((b) => (
                  <li key={b.id} className="text-sm leading-snug">{b.empowering || b.limiting}</li>
                ))}
              </ul>
            )}
          </Card>
        </Link>
      </div>

      <div className="mt-6 text-center">
        <Link href="/v2/setup" className="text-xs" style={{ color: "var(--v2-faint)" }}>
          Settings & key →
        </Link>
      </div>
    </div>
  );
}

function computeStreak(datesSorted: string[]): number {
  if (!datesSorted.length) return 0;
  const set = new Set(datesSorted);
  let streak = 0;
  const d = new Date();
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
