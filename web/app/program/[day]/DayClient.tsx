"use client";

import Link from "next/link";
import { useEffect, useState, use } from "react";
import {
  audioUrlForDay,
  loadDay,
  loadDaysIndex,
} from "@/lib/program";
import {
  getDayProgress,
  saveDayProgress,
} from "@/lib/db";
import {
  extractAndDedupCommitments,
  regenerateSynthesis,
} from "@/lib/momentum";
import { checkExerciseAnswers, feedbackIsStale } from "@/lib/exercise";
import type {
  ProgramDay,
  ProgramDayMeta,
  DayProgress,
} from "@/lib/types";
import { Section } from "@/components/Section";

export default function DayClient({
  params,
}: {
  params: Promise<{ day: string }>;
}) {
  const { day: dayParam } = use(params);
  const dayNum = parseInt(dayParam, 10);

  const [meta, setMeta] = useState<ProgramDayMeta | null>(null);
  const [data, setData] = useState<ProgramDay | null>(null);
  const [progress, setProgress] = useState<DayProgress | null>(null);
  const [savingCommit, setSavingCommit] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    (async () => {
      const idx = await loadDaysIndex();
      setMeta(idx.days.find((d) => d.day === dayNum) ?? null);
      setData(await loadDay(dayNum));
      setProgress(await getDayProgress(dayNum));
    })();
  }, [dayNum]);

  if (!meta || !data || !progress) {
    return <div className="p-6 text-faint">Loading…</div>;
  }

  const audioUrl = audioUrlForDay(meta);

  function updateAnswer(qid: string, val: string) {
    if (!progress) return;
    const next = { ...progress, exerciseAnswers: { ...progress.exerciseAnswers, [qid]: val } };
    setProgress(next);
  }

  async function saveAnswers() {
    if (!progress) return;
    await saveDayProgress(progress);
  }

  async function markComplete() {
    if (!progress) return;
    const next = { ...progress, completedAt: Date.now() };
    setProgress(next);
    await saveDayProgress(next);
  }

  async function checkAnswers() {
    if (!progress || !data) return;
    await saveAnswers();
    const hasAny = Object.values(progress.exerciseAnswers).some((v) =>
      (v || "").trim(),
    );
    if (!hasAny) {
      alert("Fill something in first.");
      return;
    }
    setChecking(true);
    try {
      const feedback = await checkExerciseAnswers(data, progress.exerciseAnswers);
      const next = { ...progress, feedback };
      setProgress(next);
      await saveDayProgress(next);
    } catch (err) {
      alert("Failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setChecking(false);
    }
  }

  async function commitAnswers() {
    if (!progress || !data) return;
    await saveAnswers();
    setSavingCommit(true);
    try {
      const result = await extractAndDedupCommitments(data, progress.exerciseAnswers);
      if (result.created === 0 && result.merged === 0) {
        alert("Saved your answers, but no clear commitments were extracted.");
        return;
      }
      // Synthesis runs in the background — refreshes Momentum on next visit.
      regenerateSynthesis().catch(() => {
        /* swallow — synthesis is optional */
      });
      const parts: string[] = [];
      if (result.created) parts.push(`${result.created} new`);
      if (result.merged) parts.push(`${result.merged} merged into existing`);
      alert(`Saved to Momentum — ${parts.join(", ")}.`);
    } catch (err) {
      alert("Failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingCommit(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-5 pt-8 pb-8">
      <Link href="/program" className="text-xs text-faint mb-4 inline-block">
        ← All sessions
      </Link>

      <header className="mb-6">
        <p className="text-xs uppercase tracking-widest text-faint mb-2">
          Day {meta.day}
          {meta.covers.length > 1 &&
            ` · covers Tony's days ${meta.covers[0]}–${meta.covers[meta.covers.length - 1]}`}
        </p>
        <h1 className="text-2xl font-bold tracking-tight leading-tight">{data.title}</h1>
        <p className="text-sm text-muted mt-3 leading-relaxed">{data.summary}</p>
      </header>

      {audioUrl && (
        <Section title="Listen" defaultOpen={true}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-faint">
              {Math.floor(meta.duration_seconds / 60)} min
            </span>
            <button
              onClick={() => {
                navigator.serviceWorker?.controller?.postMessage({
                  type: "prefetch-audio",
                  url: audioUrl,
                });
                alert("Downloading for offline use.");
              }}
              className="text-[11px] text-faint hover:text-ink"
            >
              ↓ Save offline
            </button>
          </div>
          <audio
            controls
            preload="metadata"
            src={audioUrl}
            onPlay={async () => {
              if (progress && !progress.audioPlayedAt) {
                const next = { ...progress, audioPlayedAt: Date.now() };
                setProgress(next);
                await saveDayProgress(next);
              }
            }}
          />
        </Section>
      )}

      <Section title="Keypoints" count={data.keypoints.length} defaultOpen={false}>
        <ul className="divide-y divide-line">
          {data.keypoints.map((k, i) => (
            <li key={i} className="py-3 first:pt-1 last:pb-0">
              <h3 className="font-semibold mb-1.5 leading-snug">{k.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{k.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      {data.frameworks.length > 0 && (
        <Section title="Frameworks" count={data.frameworks.length} defaultOpen={false}>
          <ul className="divide-y divide-line">
            {data.frameworks.map((f, i) => (
              <li key={i} className="py-3 first:pt-1 last:pb-0">
                <h3 className="font-semibold mb-1.5">{f.name}</h3>
                <p className="text-sm text-muted mb-3 leading-relaxed">{f.description}</p>
                <ol className="space-y-2.5">
                  {f.steps.map((s, j) => (
                    <li key={j} className="text-sm">
                      <span className="text-faint mr-2">{j + 1}.</span>
                      <span className="font-semibold">{s.name}</span>
                      <span className="text-muted"> — {s.detail}</span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Exercise" count={data.exercise.questions.length} defaultOpen={true}>
        <p className="text-sm text-muted leading-relaxed mb-4">{data.exercise.intro}</p>
        <div className="space-y-5">
          {data.exercise.questions.map((q) => (
            <div key={q.id}>
              <label className="block mb-1 font-semibold">{q.label}</label>
              <p className="text-xs text-faint mb-2">{q.guidance}</p>
              <textarea
                value={progress.exerciseAnswers[q.id] ?? ""}
                onChange={(e) => updateAnswer(q.id, e.target.value)}
                onBlur={saveAnswers}
                placeholder="…"
                className="w-full bg-page border border-line rounded-lg px-3 py-2.5 text-sm leading-relaxed min-h-[80px] focus:outline-none focus:border-ink/30"
              />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 mt-6">
          <button
            disabled={checking}
            onClick={checkAnswers}
            className="px-4 py-2 rounded-lg bg-elevate border border-line text-sm font-medium disabled:opacity-50"
          >
            {checking ? "Checking…" : progress.feedback ? "↻ Re-check" : "✓ Check my answers"}
          </button>
          <button
            disabled={savingCommit}
            onClick={commitAnswers}
            className="px-4 py-2 rounded-lg bg-accent text-accent-ink text-sm font-medium disabled:opacity-50"
          >
            {savingCommit ? "Saving…" : "Save & extract commitments"}
          </button>
          <button
            onClick={markComplete}
            className={`px-4 py-2 rounded-lg text-sm font-medium border ${
              progress.completedAt
                ? "border-line text-ok"
                : "border-line bg-elevate"
            }`}
          >
            {progress.completedAt ? "✓ Completed" : "Mark complete"}
          </button>
        </div>

        {progress.feedback && (() => {
          const stale = feedbackIsStale(progress.feedback, progress.exerciseAnswers);
          const verdictMeta = {
            needs_work: { label: "Needs work", cls: "bg-warn-bg border-warn-line text-warn-ink" },
            good: { label: "Good", cls: "bg-elevate border-line text-ink" },
            great: { label: "Great", cls: "border-line text-ok" },
          }[progress.feedback.verdict];
          return (
            <div className={`mt-5 rounded-xl border p-4 ${verdictMeta.cls}`}>
              <div className="flex items-baseline justify-between gap-3 mb-2">
                <p className="text-xs uppercase tracking-widest font-semibold">
                  {verdictMeta.label}
                </p>
                <span className="text-[10px] text-faint">
                  {stale ? "stale — re-check" : new Date(progress.feedback.generatedAt).toLocaleString()}
                </span>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {progress.feedback.comment}
              </p>
            </div>
          );
        })()}
      </Section>
    </div>
  );
}
