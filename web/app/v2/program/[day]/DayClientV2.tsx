"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { audioUrlForDay, loadDay, loadDaysIndex } from "@/lib/program";
import { withBasePath } from "@/lib/url";
import { AudioPlayer } from "@/components/AudioPlayer";
import { addBelief, getDayProgressV2, saveDayProgressV2 } from "@/lib/v2/db";
import { arcForDay } from "@/lib/v2/journey";
import { DOMAINS } from "@/lib/v2/types";
import type { Domain, DayProgressV2, NacWork } from "@/lib/v2/types";
import type { ProgramDay, ProgramDayMeta } from "@/lib/types";
import { Btn, Card, Field, Label, notifySelfModelChanged } from "@/components/v2/ui";

const NAC_FIELDS: { key: keyof NacWork; label: string; hint: string }[] = [
  { key: "outcome", label: "What do you actually want here?", hint: "Be concrete. Vague outcomes produce vague action." },
  { key: "block", label: "What's really stopping you?", hint: "The pattern, the story, the avoidance — name it honestly." },
  { key: "leverage", label: "Get leverage", hint: "What does it cost you to stay this way? What opens up if you change? Make the pain and the reward real." },
  { key: "newPattern", label: "The new empowering alternative", hint: "What will you do / believe instead, that gives the same payoff in a better way?" },
  { key: "test", label: "How you'll test it this week", hint: "One concrete rep you can run in the next few days." },
];

export default function DayClientV2({ params }: { params: Promise<{ day: string }> }) {
  const { day: dayParam } = use(params);
  const dayNum = parseInt(dayParam, 10);

  const [meta, setMeta] = useState<ProgramDayMeta | null>(null);
  const [data, setData] = useState<ProgramDay | null>(null);
  const [progress, setProgress] = useState<DayProgressV2 | null>(null);

  // belief capture
  const [bDomain, setBDomain] = useState<Domain>("self");
  const [bLimiting, setBLimiting] = useState("");
  const [bEmpowering, setBEmpowering] = useState("");
  const [beliefSaved, setBeliefSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const idx = await loadDaysIndex();
      setMeta(idx.days.find((d) => d.day === dayNum) ?? null);
      setData(await loadDay(dayNum));
      setProgress(await getDayProgressV2(dayNum));
    })();
  }, [dayNum]);

  if (!meta || !data || !progress) {
    return <div className="px-5 pt-20 text-center" style={{ color: "var(--v2-faint)" }}>…</div>;
  }

  const arc = arcForDay(dayNum);
  const audioUrl = audioUrlForDay(meta);

  function setNac(key: keyof NacWork, val: string) {
    setProgress((p) => (p ? { ...p, nac: { ...p.nac, [key]: val } } : p));
  }
  async function saveNac() {
    if (progress) await saveDayProgressV2(progress);
  }
  async function markComplete() {
    if (!progress) return;
    const next = { ...progress, completedAt: progress.completedAt ? undefined : Date.now() };
    setProgress(next);
    await saveDayProgressV2(next);
  }
  async function saveBelief() {
    if (!bEmpowering.trim() && !bLimiting.trim()) return;
    await addBelief({
      domain: bDomain,
      limiting: bLimiting.trim(),
      empowering: bEmpowering.trim(),
      state: "named",
      sourceDay: dayNum,
    });
    setBeliefSaved(true);
    setBLimiting("");
    setBEmpowering("");
    notifySelfModelChanged();
    setTimeout(() => setBeliefSaved(false), 2200);
  }

  return (
    <div className="max-w-md mx-auto px-5 pt-10">
      <Link href="/v2/journey" className="text-xs v2-press" style={{ color: "var(--v2-faint)" }}>← Journey</Link>

      <header className="mt-3 mb-6 v2-rise">
        <Label>
          Day {meta.day}
          {meta.covers.length > 1 && ` · Tony days ${meta.covers[0]}–${meta.covers[meta.covers.length - 1]}`}
        </Label>
        <h1 className="text-2xl font-semibold tracking-tight leading-tight">{data.title}</h1>
        {arc && (
          <p className="text-base leading-relaxed mt-3" style={{ color: "var(--v2-accent)" }}>{arc.paradigm}</p>
        )}
        <p className="text-sm leading-relaxed mt-3" style={{ color: "var(--v2-muted)" }}>{data.summary}</p>
      </header>

      {/* Listen */}
      {audioUrl && (
        <Card className="p-4 mb-5 v2-rise v2-rise-2">
          <div className="flex items-center justify-between mb-2">
            <Label>Listen · {Math.round(meta.duration_seconds / 60)} min</Label>
            <button
              onClick={() => {
                navigator.serviceWorker?.controller?.postMessage({ type: "prefetch-audio", url: audioUrl });
              }}
              className="text-[11px] v2-press"
              style={{ color: "var(--v2-faint)" }}
            >
              ↓ Save offline
            </button>
          </div>
          <AudioPlayer
            src={audioUrl}
            title={data.title}
            subtitle={`Day ${meta.day} · Personal Power II`}
            artworkSrc={withBasePath("/icon-512.png")}
            onPlayed={async () => {
              if (progress && !progress.audioPlayedAt) {
                const next = { ...progress, audioPlayedAt: Date.now() };
                setProgress(next);
                await saveDayProgressV2(next);
              }
            }}
          />
        </Card>
      )}

      {/* The ideas — keypoints as readable cards */}
      <section className="mb-6 v2-rise v2-rise-3">
        <Label>The shift</Label>
        <div className="space-y-3 mt-1">
          {data.keypoints.map((k, i) => (
            <Card key={i} className="p-4" soft>
              <h3 className="font-semibold leading-snug mb-1.5">{k.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--v2-muted)" }}>{k.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Frameworks */}
      {data.frameworks.length > 0 && (
        <section className="mb-6 v2-rise">
          <Label>Frameworks introduced</Label>
          <div className="space-y-3 mt-1">
            {data.frameworks.map((f, i) => (
              <Card key={i} className="p-4" soft>
                <h3 className="font-semibold mb-1">{f.name}</h3>
                <p className="text-sm mb-2.5" style={{ color: "var(--v2-muted)" }}>{f.description}</p>
                <ol className="space-y-1.5">
                  {f.steps.map((s, j) => (
                    <li key={j} className="text-sm">
                      <span style={{ color: "var(--v2-faint)" }}>{j + 1}. </span>
                      <span className="font-medium">{s.name}</span>
                      <span style={{ color: "var(--v2-muted)" }}> — {s.detail}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* The work — run the loop */}
      <section className="mb-6 v2-rise">
        <Label>Run it on yourself</Label>
        <p className="text-sm mb-3" style={{ color: "var(--v2-muted)" }}>Don't study the session — use it. Work the loop on something real.</p>
        <Card className="p-5">
          <div className="space-y-5">
            {NAC_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium mb-1">{f.label}</label>
                <p className="text-[12px] mb-2" style={{ color: "var(--v2-faint)" }}>{f.hint}</p>
                <Field
                  value={progress.nac[f.key] ?? ""}
                  onChange={(v) => setNac(f.key, v)}
                  onBlur={saveNac}
                  placeholder="…"
                  multiline
                  rows={2}
                />
              </div>
            ))}
          </div>
        </Card>
      </section>

      {/* Capture a belief → self-model */}
      <section className="mb-6 v2-rise">
        <Label>Name the belief this shifts</Label>
        <p className="text-sm mb-3" style={{ color: "var(--v2-muted)" }}>
          Optional — but this is how the work compounds. It lands in <span style={{ color: "var(--v2-ink)" }}>You</span> and you condition it over time.
        </p>
        <Card className="p-5">
          <div className="flex flex-wrap gap-1.5 mb-3">
            {DOMAINS.map((d) => (
              <button
                key={d.key}
                onClick={() => setBDomain(d.key)}
                className="text-[11px] px-2.5 py-1 rounded-full v2-press"
                style={{
                  background: bDomain === d.key ? "var(--v2-accent-soft)" : "rgba(255,255,255,0.05)",
                  color: bDomain === d.key ? "var(--v2-accent)" : "var(--v2-faint)",
                  border: "1px solid var(--v2-line)",
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div className="space-y-2.5">
            <Field value={bLimiting} onChange={setBLimiting} placeholder="The old belief — “I…”" multiline rows={2} />
            <Field value={bEmpowering} onChange={setBEmpowering} placeholder="The one I'm installing instead" multiline rows={2} />
            <Btn onClick={saveBelief} disabled={beliefSaved}>{beliefSaved ? "✓ Added to You" : "+ Add to what I'm rewiring"}</Btn>
          </div>
        </Card>
      </section>

      <div className="mb-4">
        <Btn variant={progress.completedAt ? "ghost" : "primary"} onClick={markComplete} className="w-full">
          {progress.completedAt ? "✓ Completed — undo?" : "Mark this session complete"}
        </Btn>
      </div>
    </div>
  );
}
