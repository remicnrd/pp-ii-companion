"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getPriming, savePriming } from "@/lib/v2/db";
import { todayISO } from "@/lib/v2/selfModel";
import type { PrimingEntry } from "@/lib/v2/types";
import { Btn, Card, Field, Label } from "@/components/v2/ui";

// Tony's actual Priming sequence.
const STEPS = ["Breathe", "Gratitude", "Strengthen", "Three to Thrive"] as const;
const TOTAL_ROUNDS = 3;

export default function PrimingPage() {
  const router = useRouter();
  const date = todayISO();
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const [breathRounds, setBreathRounds] = useState(0);
  const [gratitude, setGratitude] = useState<string[]>(["", "", ""]);
  const [blessing, setBlessing] = useState("");
  const [thrive, setThrive] = useState<string[]>(["", "", ""]);

  useEffect(() => {
    (async () => {
      const existing = await getPriming(date);
      if (existing) {
        setBreathRounds(existing.breathRounds ?? 0);
        setGratitude([existing.gratitude[0] ?? "", existing.gratitude[1] ?? "", existing.gratitude[2] ?? ""]);
        setBlessing(existing.blessing ?? "");
        setThrive([existing.threeToThrive[0] ?? "", existing.threeToThrive[1] ?? "", existing.threeToThrive[2] ?? ""]);
      }
      setLoaded(true);
    })();
  }, [date]);

  const canFinish = useMemo(
    () => breathRounds > 0 || gratitude.some((g) => g.trim()) || thrive.some((t) => t.trim()),
    [breathRounds, gratitude, thrive],
  );

  async function finish() {
    const entry: PrimingEntry = {
      date,
      breathRounds,
      gratitude: gratitude.map((g) => g.trim()).filter(Boolean),
      blessing: blessing.trim(),
      threeToThrive: thrive.map((t) => t.trim()).filter(Boolean),
      completedAt: Date.now(),
    };
    await savePriming(entry);
    router.push("/v2");
  }

  if (!loaded) return <div className="px-5 pt-20 text-center" style={{ color: "var(--v2-faint)" }}>…</div>;

  return (
    <div className="max-w-md mx-auto px-5 pt-10">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <Label>Priming</Label>
          <p className="text-xl font-semibold">{STEPS[step]}</p>
        </div>
        <button onClick={() => router.push("/v2")} className="text-xs" style={{ color: "var(--v2-faint)" }}>
          Close
        </button>
      </header>

      <div className="flex gap-1.5 mb-6">
        {STEPS.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full" style={{ background: i <= step ? "var(--v2-accent)" : "rgba(255,255,255,0.1)", transition: "background .3s" }} />
        ))}
      </div>

      <Card className="p-5 mb-6 v2-rise" key={step}>
        {step === 0 && (
          <div className="flex flex-col items-center text-center py-2">
            <p className="text-base leading-relaxed mb-1">Three rounds of thirty breaths.</p>
            <p className="text-sm mb-6" style={{ color: "var(--v2-faint)" }}>
              Breathe in through the nose as the orb grows, out as it shrinks — strong and rhythmic. Lift the arms with each in-breath if you like. This is where Tony starts.
            </p>
            <div className="v2-breath" style={{ width: 150, height: 150 }} />
            <p className="mt-6 text-sm" style={{ color: "var(--v2-muted)" }}>
              Round <span style={{ color: "var(--v2-accent)" }}>{Math.min(breathRounds + 1, TOTAL_ROUNDS)}</span> of {TOTAL_ROUNDS}
            </p>
            <div className="flex gap-2 mt-4">
              <Btn onClick={() => setBreathRounds((r) => Math.min(TOTAL_ROUNDS, r + 1))} disabled={breathRounds >= TOTAL_ROUNDS}>
                {breathRounds >= TOTAL_ROUNDS ? "✓ All rounds done" : "Round complete"}
              </Btn>
              {breathRounds > 0 && (
                <button onClick={() => setBreathRounds((r) => Math.max(0, r - 1))} className="text-sm v2-press" style={{ color: "var(--v2-faint)" }}>undo</button>
              )}
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <p className="text-base leading-relaxed mb-1">Three things you're grateful for.</p>
            <p className="text-sm mb-4" style={{ color: "var(--v2-faint)" }}>
              Don't just list them — step into each one and <em>feel</em> it fully, as if you're there. Let one be something small (a moment, the air, a face).
            </p>
            <div className="space-y-2.5">
              {gratitude.map((g, i) => (
                <Field key={i} value={g} onChange={(v) => setGratitude((arr) => arr.map((x, j) => (j === i ? v : x)))} placeholder={`Grateful for…`} />
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <p className="text-base leading-relaxed mb-1">Draw in strength — then send it out.</p>
            <p className="text-sm mb-4" style={{ color: "var(--v2-faint)" }}>
              Feel a warm light come down through the top of your head, healing and strengthening your whole body. Then let it grow and radiate out — send that strength and blessing to the people you care about.
            </p>
            <Field value={blessing} onChange={setBlessing} placeholder="Who did you send strength to? (optional)" multiline rows={3} />
          </div>
        )}

        {step === 3 && (
          <div>
            <p className="text-base leading-relaxed mb-1">Three to Thrive.</p>
            <p className="text-sm mb-4" style={{ color: "var(--v2-faint)" }}>
              Three things you want to make happen. See each one as already <em>done</em> — feel it, celebrate it as if it's real right now.
            </p>
            <div className="space-y-2.5">
              {thrive.map((t, i) => (
                <Field key={i} value={t} onChange={(v) => setThrive((arr) => arr.map((x, j) => (j === i ? v : x)))} placeholder={`Already accomplished…`} />
              ))}
            </div>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Btn onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>Back</Btn>
        {step < STEPS.length - 1 ? (
          <Btn variant="primary" onClick={() => setStep((s) => s + 1)}>Continue</Btn>
        ) : (
          <Btn variant="primary" onClick={finish} disabled={!canFinish}>Finish priming</Btn>
        )}
      </div>
    </div>
  );
}
