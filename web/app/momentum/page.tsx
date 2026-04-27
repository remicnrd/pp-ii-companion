"use client";

import { useEffect, useState } from "react";
import { db, getSynthesis } from "@/lib/db";
import {
  maybeRegenerateSynthesisDaily,
  regenerateSynthesis,
} from "@/lib/momentum";
import type { Commitment, MomentumSynthesis } from "@/lib/types";
import Link from "next/link";

export default function MomentumPage() {
  const [items, setItems] = useState<Commitment[]>([]);
  const [filter, setFilter] = useState<"all" | "active" | "done">("active");
  const [synthesis, setSynthesis] = useState<MomentumSynthesis | null>(null);
  const [synthLoading, setSynthLoading] = useState(false);

  async function refresh() {
    const all = await db().commitments.orderBy("createdAt").reverse().toArray();
    setItems(all);
    const s = await getSynthesis();
    setSynthesis(s ?? null);
  }

  async function ensureDailySynthesis() {
    setSynthLoading(true);
    try {
      const all = await db().commitments.toArray();
      if (all.length === 0) return;
      const refreshed = await maybeRegenerateSynthesisDaily();
      if (refreshed) {
        const s = await getSynthesis();
        setSynthesis(s ?? null);
      }
    } catch {
      /* ignore — synthesis is optional */
    } finally {
      setSynthLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await refresh();
      ensureDailySynthesis();
    })();
  }, []);

  const visible = items.filter((c) => {
    if (filter === "all") return true;
    return c.status === filter;
  });

  const grouped: Record<string, Commitment[]> = {
    "ongoing": [],
    "one-time": [],
    "unclassified": [],
  };
  for (const c of visible) grouped[c.classification].push(c);

  async function setStatus(id: number, status: Commitment["status"]) {
    await db().commitments.update(id, { status, lastReviewedAt: Date.now() });
    await refresh();
    // Synthesis updates in the background after a status change.
    regenerateSynthesis()
      .then(refresh)
      .catch(() => {});
  }

  async function deleteCommit(id: number) {
    if (!confirm("Delete this commitment?")) return;
    await db().commitments.delete(id);
    await refresh();
    regenerateSynthesis()
      .then(refresh)
      .catch(() => {});
  }

  async function manualRefreshSynthesis() {
    setSynthLoading(true);
    try {
      await regenerateSynthesis();
      const s = await getSynthesis();
      setSynthesis(s ?? null);
    } catch (err) {
      alert("Couldn't refresh: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSynthLoading(false);
    }
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

  return (
    <div className="max-w-2xl mx-auto px-5 pt-10 pb-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-faint mb-2">Momentum</p>
        <h1 className="text-3xl font-semibold tracking-tight">Your commitments</h1>
        <p className="text-sm text-muted mt-2">
          Everything you've committed to across the program. Don't move on to the next day and forget the previous ones.
        </p>
      </header>

      {(synthesis || synthLoading) && (
        <details
          open={!!synthesis}
          className="rounded-2xl border border-line bg-elevate-soft mb-6 overflow-hidden"
        >
          <summary className="flex items-baseline gap-2 px-4 py-3 text-sm font-semibold tracking-tight">
            <span className="chev text-faint text-xs leading-none">▶</span>
            <span className="uppercase tracking-widest text-[11px]">Synthesis</span>
            {synthesis && (
              <span className="text-faint text-[11px] ml-auto">
                {formatRelativeAge(synthesis.generatedAt)}
              </span>
            )}
          </summary>
          <div className="px-4 pb-4 pt-3 border-t border-line">
            {synthLoading && !synthesis && (
              <p className="text-sm text-muted">Generating…</p>
            )}
            {synthesis && (
              <>
                <div className="text-sm leading-relaxed whitespace-pre-wrap mb-3">
                  {synthesis.text}
                </div>
                <button
                  onClick={manualRefreshSynthesis}
                  disabled={synthLoading}
                  className="text-[11px] text-faint hover:text-ink disabled:opacity-50"
                >
                  {synthLoading ? "Refreshing…" : "↻ Refresh"}
                </button>
              </>
            )}
          </div>
        </details>
      )}

      <div className="flex gap-2 mb-6">
        {(["active", "done", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs uppercase tracking-widest ${
              filter === f
                ? "bg-accent text-accent-ink"
                : "bg-elevate-soft border border-line text-muted"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-line bg-elevate-soft p-6 text-center">
          <p className="text-sm text-muted mb-4">
            {items.length === 0
              ? "No commitments yet. They'll appear here as you work through the exercises."
              : "Nothing in this view."}
          </p>
          <Link
            href="/program"
            className="inline-flex items-center px-4 py-2 rounded-lg bg-accent text-accent-ink text-sm font-medium"
          >
            Open the program →
          </Link>
        </div>
      ) : (
        <>
          {(["ongoing", "one-time", "unclassified"] as const).map((cls) => {
            const list = grouped[cls];
            if (list.length === 0) return null;
            const labels = {
              ongoing: "Ongoing — habits, rituals, rules",
              "one-time": "One-time actions",
              unclassified: "Unclassified",
            };
            return (
              <section key={cls} className="mb-8">
                <p className="text-xs uppercase tracking-widest text-faint mb-3 font-semibold">
                  {labels[cls]}
                </p>
                <ul className="space-y-2">
                  {list.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-lg border border-line bg-elevate-soft p-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-[10px] uppercase tracking-widest text-faint shrink-0 mt-1">
                          Day {c.day}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm leading-snug ${
                              c.status === "done" ? "line-through text-faint" : ""
                            }`}
                          >
                            {c.text}
                          </p>
                          {c.rationale && (
                            <p className="text-[11px] text-faint mt-1">{c.rationale}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-2 justify-end">
                        {c.status === "active" && (
                          <button
                            onClick={() => setStatus(c.id!, "done")}
                            className="text-[11px] px-2 py-1 rounded-md bg-elevate text-muted border border-line"
                          >
                            ✓ Done
                          </button>
                        )}
                        {c.status !== "active" && (
                          <button
                            onClick={() => setStatus(c.id!, "active")}
                            className="text-[11px] px-2 py-1 rounded-md bg-elevate text-muted border border-line"
                          >
                            ↺ Reactivate
                          </button>
                        )}
                        <button
                          onClick={() => deleteCommit(c.id!)}
                          className="text-[11px] px-2 py-1 rounded-md text-faint hover:text-danger"
                        >
                          ✕
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </div>
  );
}
