"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSettings, getProfile } from "@/lib/db";
import { loadDaysIndex, expectedDayOnDate } from "@/lib/program";
import type { ProgramDayMeta, Settings } from "@/lib/types";

export default function Home() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [today, setToday] = useState<ProgramDayMeta | null>(null);
  const [allDays, setAllDays] = useState<ProgramDayMeta[]>([]);

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      const p = await getProfile();
      const idx = await loadDaysIndex();
      setSettings(s);
      setHasProfile(!!p?.generatedSummary);
      setAllDays(idx.days);
      if (s.startDate) {
        const audioDay = expectedDayOnDate(s.startDate);
        setToday(idx.days.find((d) => d.day === audioDay) ?? null);
      } else {
        setToday(idx.days[0]);
      }
    })();
  }, []);

  if (!settings) {
    return <div className="p-6 text-faint">Loading…</div>;
  }

  const needsSetup = !settings.apiKey || !settings.startDate || !hasProfile;

  return (
    <div className="max-w-2xl mx-auto px-5 pt-12 pb-8">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-faint mb-2">Personal Power II</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {settings.startDate ? "Today's session" : "Welcome"}
        </h1>
      </header>

      {needsSetup && (
        <div className="rounded-2xl border border-warn-line bg-warn-bg p-5 mb-6">
          <h2 className="font-semibold mb-2 text-warn-ink">Finish setup</h2>
          <ul className="text-sm text-muted space-y-1 mb-4">
            {!settings.apiKey && <li>• Add your API key</li>}
            {!settings.startDate && <li>• Pick your program start date</li>}
            {!hasProfile && <li>• Build your profile (so Coach knows you)</li>}
          </ul>
          <Link
            href="/setup"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-accent text-accent-ink text-sm font-medium"
          >
            Open Setup →
          </Link>
        </div>
      )}

      {today && (
        <Link
          href={`/program/${today.day}`}
          className="block rounded-2xl border border-line bg-elevate-soft p-5 mb-6 hover:bg-elevate transition"
        >
          <p className="text-xs uppercase tracking-widest text-faint mb-1">
            Day {today.day}
            {today.covers.length > 1 && ` · covers Tony's days ${today.covers[0]}–${today.covers[today.covers.length - 1]}`}
          </p>
          <h2 className="text-xl font-semibold mb-1">{today.title}</h2>
          <p className="text-sm text-muted line-clamp-3">{today.summary}</p>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/program"
          className="rounded-xl border border-line bg-elevate-soft p-4 hover:bg-elevate transition"
        >
          <p className="text-xs uppercase tracking-widest text-faint mb-1">Program</p>
          <p className="text-sm">All {allDays.length} sessions</p>
        </Link>
        <Link
          href="/momentum"
          className="rounded-xl border border-line bg-elevate-soft p-4 hover:bg-elevate transition"
        >
          <p className="text-xs uppercase tracking-widest text-faint mb-1">Momentum</p>
          <p className="text-sm">Your commitments</p>
        </Link>
        <Link
          href="/frameworks"
          className="rounded-xl border border-line bg-elevate-soft p-4 hover:bg-elevate transition"
        >
          <p className="text-xs uppercase tracking-widest text-faint mb-1">Frameworks</p>
          <p className="text-sm">NAC, RPM, Dickens, …</p>
        </Link>
        <Link
          href="/coach"
          className="rounded-xl border border-line bg-elevate-soft p-4 hover:bg-elevate transition"
        >
          <p className="text-xs uppercase tracking-widest text-faint mb-1">Coach</p>
          <p className="text-sm">Talk it through</p>
        </Link>
      </div>
    </div>
  );
}
