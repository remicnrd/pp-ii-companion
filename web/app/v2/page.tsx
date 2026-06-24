"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadDaysIndex, nextUnfinishedDay } from "@/lib/program";
import { vdb, getV2Settings, markConditioned, unmarkConditioned } from "@/lib/v2/db";
import { arcForDay } from "@/lib/v2/journey";
import {
  todayISO,
  streakFromDates,
  conditioningDates,
  conditionedOn,
} from "@/lib/v2/selfModel";
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
      const primingDates = (await vdb().priming.toArray()).map((p) => p.date);

      setSettings(s);
      setDay(idx.days.find((d) => d.day === dayNum) ?? null);
      setCompletedCount(completed.size);
      setTotalDays(idx.days.length);
      setBeliefs(allBeliefs);
      setPrimedToday(primingDates.includes(todayISO()));
      setPrimeStreak(streakFromDates(primingDates));
      setLoading(false);
    })();
  }, []);

  const iso = todayISO();

  async function toggleConditioned(b: Belief) {
    if (!b.id) return;
    const has = conditionedOn(b, iso);
    const next = has
      ? (b.conditionedDates ?? []).filter((d) => d !== iso)
      : [...(b.conditionedDates ?? []), iso].sort();
    setBeliefs((prev) => prev.map((x) => (x.id === b.id ? { ...x, conditionedDates: next } : x)));
    if (has) await unmarkConditioned(b.id);
    else await markConditioned(b.id);
  }

  if (loading) {
    return <div className="px-5 pt-20 text-center" style={{ color: "var(--v2-faint)" }}>…</div>;
  }

  const sessionPct = totalDays ? Math.round((completedCount / totalDays) * 100) : 0;
  const arc = day ? arcForDay(day.day) : undefined;

  const doneCount = beliefs.filter((b) => conditionedOn(b, iso)).length;
  const allDone = beliefs.length > 0 && doneCount === beliefs.length;
  const showUpStreak = streakFromDates(conditioningDates(beliefs));

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

      {/* Daily conditioning — the practice that makes it stick */}
      <section className="mb-4 v2-rise v2-rise-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <Label>Today&apos;s conditioning</Label>
            {showUpStreak > 0 && (
              <span className="text-xs font-medium" style={{ color: "var(--v2-accent)" }}>🔥 {showUpStreak}</span>
            )}
          </div>

          {beliefs.length === 0 ? (
            <p className="text-sm mt-1.5" style={{ color: "var(--v2-muted)" }}>
              Nothing to condition yet. Name the belief you&apos;re changing in a{" "}
              <Link href={day ? `/v2/program/${day.day}` : "/v2/journey"} style={{ color: "var(--v2-accent)" }}>session</Link>{" "}
              or in <Link href="/v2/you" style={{ color: "var(--v2-accent)" }}>You</Link>.
            </p>
          ) : (
            <>
              <p className="text-sm mt-1 mb-3" style={{ color: "var(--v2-muted)" }}>
                Say each one like it&apos;s already true — out loud if you can, and feel it. Don&apos;t just read it.
              </p>
              <ul className="space-y-2.5">
                {beliefs.map((b) => {
                  const done = conditionedOn(b, iso);
                  const st = streakFromDates(b.conditionedDates ?? []);
                  return (
                    <li key={b.id} className="flex items-start gap-3">
                      <button
                        onClick={() => toggleConditioned(b)}
                        aria-label={done ? "Undo today" : "Mark conditioned"}
                        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs v2-press mt-0.5"
                        style={
                          done
                            ? { background: "var(--v2-accent)", color: "#0a0a0a" }
                            : { border: "1.5px solid var(--v2-line)", color: "var(--v2-faint)" }
                        }
                      >
                        {done ? "✓" : ""}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className="text-[15px] leading-snug"
                          style={{ color: done ? "var(--v2-faint)" : "var(--v2-ink)" }}
                        >
                          {b.empowering || b.limiting}
                        </p>
                        {st > 1 && (
                          <p className="text-[11px] mt-0.5" style={{ color: "var(--v2-faint)" }}>
                            {st} days running
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs mt-3" style={{ color: allDone ? "var(--v2-accent)" : "var(--v2-faint)" }}>
                {allDone
                  ? "Done for today. This is how it sticks — see you tomorrow."
                  : `${doneCount}/${beliefs.length} conditioned`}
              </p>
              <div className="mt-2">
                <Link href="/v2/you" className="text-[11px] v2-press" style={{ color: "var(--v2-faint)" }}>
                  Manage beliefs →
                </Link>
              </div>
            </>
          )}
        </Card>
      </section>

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

      {/* Priming — optional morning ritual */}
      <Link href="/v2/priming" className="block mb-4 v2-rise v2-rise-4">
        <Card className="p-4 v2-press">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Priming · optional · ~10 min</Label>
              <p className="text-sm mt-0.5" style={{ color: "var(--v2-muted)" }}>
                {primedToday ? "Primed for today. The state is set." : "Breathe, feel it, see three wins as done."}
              </p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xl">{primedToday ? "✓" : "◎"}</div>
              {primeStreak > 0 && (
                <div className="text-[11px] mt-0.5" style={{ color: "var(--v2-accent)" }}>{primeStreak}d</div>
              )}
            </div>
          </div>
        </Card>
      </Link>

      <div className="mt-6 text-center">
        <Link href="/v2/setup" className="text-xs" style={{ color: "var(--v2-faint)" }}>
          Settings & key →
        </Link>
      </div>
    </div>
  );
}
