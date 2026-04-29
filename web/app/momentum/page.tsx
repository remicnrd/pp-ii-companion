"use client";

import { useEffect, useState } from "react";
import { db, getSynthesis } from "@/lib/db";
import {
  dailyRatio,
  dailyStreak,
  markDailyDone,
  regenerateMomentum,
  unmarkDailyDone,
} from "@/lib/momentum";
import type { Commitment, MomentumSynthesis } from "@/lib/types";
import Link from "next/link";

export default function MomentumPage() {
  const [items, setItems] = useState<Commitment[]>([]);
  const [synthesis, setSynthesis] = useState<MomentumSynthesis | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);

  async function refresh() {
    const all = await db().commitments.orderBy("createdAt").reverse().toArray();
    setItems(all);
    const s = await getSynthesis();
    setSynthesis(s ?? null);
  }

  useEffect(() => {
    refresh();
  }, []);

  const todayISO = new Date().toISOString().slice(0, 10);

  async function handleRegenerate() {
    setRegenerating(true);
    try {
      await regenerateMomentum();
      await refresh();
    } catch (err) {
      alert("Failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setRegenerating(false);
    }
  }

  async function setOnceStatus(id: number, status: Commitment["status"]) {
    await db().commitments.update(id, { status, lastReviewedAt: Date.now() });
    refresh();
  }

  async function toggleDailyToday(c: Commitment) {
    if (!c.id) return;
    if (c.dailyChecks.includes(todayISO)) {
      await unmarkDailyDone(c.id);
    } else {
      await markDailyDone(c.id);
    }
    refresh();
  }

  async function archive(id: number) {
    if (!confirm("Archive this card?")) return;
    await db().commitments.update(id, { archivedAt: Date.now() });
    refresh();
  }

  async function unarchive(id: number) {
    await db().commitments.update(id, { archivedAt: undefined });
    refresh();
  }

  function formatRelativeAge(ts: number): string {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  const visible = items.filter((c) => (showArchived ? !!c.archivedAt : !c.archivedAt));
  const dailyCards = visible.filter((c) => c.classification === "daily");
  const onceActive = visible.filter(
    (c) => c.classification === "once" && c.status === "active",
  );
  const onceDone = visible.filter(
    (c) => c.classification === "once" && c.status !== "active",
  );
  const unclassified = visible.filter((c) => c.classification === "unclassified");

  const archivedCount = items.filter((c) => !!c.archivedAt).length;

  return (
    <div className="max-w-2xl mx-auto px-5 pt-10 pb-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-faint mb-2">Momentum</p>
        <h1 className="text-3xl font-semibold tracking-tight">Where you are</h1>
        <p className="text-sm text-muted mt-2">
          Synthesized from sessions you've actually done. Updates whenever you save a day.
        </p>
      </header>

      {synthesis && (
        <details
          open
          className="rounded-2xl border border-line bg-elevate-soft mb-6 overflow-hidden"
        >
          <summary className="flex items-baseline gap-2 px-4 py-3 text-sm font-semibold tracking-tight">
            <span className="chev text-faint text-xs leading-none">▶</span>
            <span className="uppercase tracking-widest text-[11px]">Synthesis</span>
            <span className="text-faint text-[11px] ml-auto">
              {formatRelativeAge(synthesis.generatedAt)}
            </span>
          </summary>
          <div className="px-4 pb-4 pt-3 border-t border-line">
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {synthesis.text}
            </div>
          </div>
        </details>
      )}

      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="px-3 py-1.5 rounded-md text-xs uppercase tracking-widest bg-elevate border border-line text-muted disabled:opacity-50"
        >
          {regenerating ? "Updating…" : "↻ Refresh"}
        </button>
        {archivedCount > 0 && (
          <button
            onClick={() => setShowArchived((s) => !s)}
            className="px-3 py-1.5 rounded-md text-xs uppercase tracking-widest bg-elevate-soft border border-line text-muted"
          >
            {showArchived ? "← Active" : `Archived (${archivedCount})`}
          </button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-line bg-elevate-soft p-6 text-center">
          <p className="text-sm text-muted mb-4">
            {showArchived
              ? "Nothing archived."
              : items.length === 0
                ? "Nothing yet. Save a day's exercise and Momentum will populate."
                : "No active cards. Try Refresh."}
          </p>
          {!showArchived && (
            <Link
              href="/program"
              className="inline-flex items-center px-4 py-2 rounded-lg bg-accent text-accent-ink text-sm font-medium"
            >
              Open the program →
            </Link>
          )}
        </div>
      ) : (
        <>
          {dailyCards.length > 0 && (
            <section className="mb-8">
              <p className="text-xs uppercase tracking-widest text-faint mb-3 font-semibold">
                Daily — habits, rituals, rules
              </p>
              <ul className="space-y-2">
                {dailyCards.map((c) => {
                  const doneToday = c.dailyChecks.includes(todayISO);
                  const streak = dailyStreak(c.dailyChecks);
                  const { done, total } = dailyRatio(c);
                  return (
                    <li
                      key={c.id}
                      className="rounded-lg border border-line bg-elevate-soft p-3"
                    >
                      <div className="flex items-start gap-3 mb-2">
                        <button
                          aria-label={doneToday ? "Unmark today" : "Mark today done"}
                          onClick={() => toggleDailyToday(c)}
                          className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-xs ${
                            doneToday
                              ? "bg-ok border-ok text-accent-ink"
                              : "border-line text-muted hover:bg-elevate"
                          }`}
                        >
                          {doneToday ? "✓" : ""}
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-snug font-medium">{c.text}</p>
                          {c.rationale && (
                            <p className="text-[11px] text-faint mt-1">{c.rationale}</p>
                          )}
                          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted">
                            {streak > 0 && (
                              <span>
                                🔥 <strong className="text-ink">{streak}</strong>{" "}
                                day streak
                              </span>
                            )}
                            <span>
                              {done}/{total} days
                            </span>
                            {c.sources.length > 0 && (
                              <span className="text-faint">
                                · day{c.sources.length > 1 ? "s" : ""} {c.sources.join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => archive(c.id!)}
                          className="text-[11px] text-faint hover:text-danger shrink-0"
                          aria-label="Archive"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {onceActive.length > 0 && (
            <section className="mb-8">
              <p className="text-xs uppercase tracking-widest text-faint mb-3 font-semibold">
                One-time actions
              </p>
              <ul className="space-y-2">
                {onceActive.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-line bg-elevate-soft p-3"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        aria-label="Mark done"
                        onClick={() => setOnceStatus(c.id!, "done")}
                        className="shrink-0 w-6 h-6 rounded border border-line text-muted hover:bg-elevate text-xs"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug">{c.text}</p>
                        {c.rationale && (
                          <p className="text-[11px] text-faint mt-1">{c.rationale}</p>
                        )}
                        {c.sources.length > 0 && (
                          <p className="text-[10px] text-faint mt-1 uppercase tracking-widest">
                            day{c.sources.length > 1 ? "s" : ""} {c.sources.join(", ")}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => archive(c.id!)}
                        className="text-[11px] text-faint hover:text-danger shrink-0"
                        aria-label="Archive"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {onceDone.length > 0 && (
            <section className="mb-8">
              <p className="text-xs uppercase tracking-widest text-faint mb-3 font-semibold">
                Done
              </p>
              <ul className="space-y-2">
                {onceDone.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-line bg-elevate-soft p-3"
                  >
                    <div className="flex items-start gap-3">
                      <button
                        aria-label="Reactivate"
                        onClick={() => setOnceStatus(c.id!, "active")}
                        className="shrink-0 w-6 h-6 rounded bg-ok border border-ok text-accent-ink text-xs flex items-center justify-center"
                      >
                        ✓
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm leading-snug line-through text-faint">{c.text}</p>
                      </div>
                      <button
                        onClick={() => archive(c.id!)}
                        className="text-[11px] text-faint hover:text-danger shrink-0"
                        aria-label="Archive"
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {unclassified.length > 0 && (
            <section className="mb-8">
              <p className="text-xs uppercase tracking-widest text-faint mb-3 font-semibold">
                Unclassified
              </p>
              <ul className="space-y-2">
                {unclassified.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-line bg-elevate-soft p-3 flex items-start gap-3"
                  >
                    <p className="flex-1 text-sm leading-snug">{c.text}</p>
                    <button
                      onClick={() => archive(c.id!)}
                      className="text-[11px] text-faint hover:text-danger shrink-0"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {showArchived && (
            <section className="mb-8">
              <p className="text-xs uppercase tracking-widest text-faint mb-3 font-semibold">
                Archived
              </p>
              <ul className="space-y-2">
                {visible.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-lg border border-line bg-elevate-soft p-3 flex items-start gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-faint leading-snug">{c.text}</p>
                    </div>
                    <button
                      onClick={() => unarchive(c.id!)}
                      className="text-[11px] text-faint hover:text-ink shrink-0"
                    >
                      ↺ Restore
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
