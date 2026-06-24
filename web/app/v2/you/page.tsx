"use client";

import { useEffect, useState } from "react";
import {
  addBelief,
  addThermoArea,
  deleteThermoArea,
  getV2Settings,
  saveV2Settings,
  updateBelief,
  updateThermoArea,
  vdb,
} from "@/lib/v2/db";
import { reviewSelfModel } from "@/lib/v2/coach";
import { streakFromDates } from "@/lib/v2/selfModel";
import { DOMAINS } from "@/lib/v2/types";
import type { Belief, CoreValue, Domain, SelfReview, ThermostatArea } from "@/lib/v2/types";
import { Btn, Card, Field, Label, notifySelfModelChanged } from "@/components/v2/ui";

function ageLabel(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function YouPage() {
  const [loaded, setLoaded] = useState(false);
  const [intent, setIntent] = useState("");
  const [beliefs, setBeliefs] = useState<Belief[]>([]);
  const [areas, setAreas] = useState<ThermostatArea[]>([]);
  const [values, setValues] = useState<CoreValue[]>([]);

  const [addingBelief, setAddingBelief] = useState(false);
  const [nbDomain, setNbDomain] = useState<Domain>("self");
  const [nbLimiting, setNbLimiting] = useState("");
  const [nbEmpowering, setNbEmpowering] = useState("");

  const [newValue, setNewValue] = useState("");
  const [newRule, setNewRule] = useState("");

  const [review, setReview] = useState<SelfReview | null>(null);
  const [reviewing, setReviewing] = useState(false);

  async function refresh() {
    const s = await getV2Settings();
    setIntent(s.intentName ?? "");
    setReview(s.review ?? null);
    setBeliefs((await vdb().beliefs.toArray()).filter((b) => !b.archivedAt).sort((a, b) => a.createdAt - b.createdAt));
    setAreas((await vdb().thermoAreas.toArray()).sort((a, b) => a.createdAt - b.createdAt));
    setValues((await vdb().values.toArray()).sort((a, b) => a.rank - b.rank || a.createdAt - b.createdAt));
  }

  async function runReview() {
    setReviewing(true);
    try {
      setReview(await reviewSelfModel());
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setReviewing(false);
    }
  }

  useEffect(() => {
    (async () => {
      await refresh();
      setLoaded(true);
    })();
  }, []);

  function editArea(id: number, key: keyof ThermostatArea, val: string) {
    setAreas((prev) => prev.map((a) => (a.id === id ? { ...a, [key]: val } : a)));
  }
  async function persistArea(a: ThermostatArea) {
    if (!a.id) return;
    await updateThermoArea(a.id, {
      area: a.area,
      current: a.current,
      target: a.target,
      conditioning: a.conditioning,
    });
  }
  async function addArea() {
    await addThermoArea({ area: "", current: "", target: "", conditioning: "" });
    await refresh();
  }
  async function removeArea(id: number) {
    await deleteThermoArea(id);
    await refresh();
  }

  async function archive(b: Belief) {
    await updateBelief(b.id!, { archivedAt: Date.now() });
    await refresh();
    notifySelfModelChanged();
  }

  async function submitBelief() {
    if (!nbEmpowering.trim() && !nbLimiting.trim()) return;
    await addBelief({
      domain: nbDomain,
      limiting: nbLimiting.trim(),
      empowering: nbEmpowering.trim(),
      state: "named",
    });
    setNbLimiting("");
    setNbEmpowering("");
    setAddingBelief(false);
    await refresh();
    notifySelfModelChanged();
    // If they've already used the review, re-check the big picture with the new card.
    if (review) await runReview();
  }

  async function addValue() {
    if (!newValue.trim()) return;
    const rank = (values.length ? Math.max(...values.map((v) => v.rank)) : 0) + 1;
    await vdb().values.add({ name: newValue.trim(), rule: newRule.trim() || undefined, rank, createdAt: Date.now() });
    setNewValue("");
    setNewRule("");
    await refresh();
  }
  async function makeTop(v: CoreValue) {
    const min = values.length ? Math.min(...values.map((x) => x.rank)) : 1;
    await vdb().values.update(v.id!, { rank: min - 1 });
    await refresh();
  }
  async function delValue(v: CoreValue) {
    await vdb().values.delete(v.id!);
    await refresh();
  }

  if (!loaded) return <div className="px-5 pt-20 text-center" style={{ color: "var(--v2-faint)" }}>…</div>;

  return (
    <div className="max-w-md mx-auto px-5 pt-12">
      <header className="mb-6 v2-rise">
        <Label>You</Label>
        <h1 className="text-[26px] font-semibold tracking-tight">What you're working on</h1>
      </header>

      {/* Intent */}
      <Card className="p-5 mb-4 v2-rise">
        <Label>The change you're after</Label>
        <Field
          value={intent}
          onChange={setIntent}
          onBlur={() => saveV2Settings({ intentName: intent.trim() || undefined })}
          placeholder="e.g. someone who finishes what they start"
        />
        <p className="text-[11px] mt-2" style={{ color: "var(--v2-faint)" }}>Shows up on your Today screen.</p>
      </Card>

      {/* Thermostat */}
      <Card className="p-5 mb-4 v2-rise v2-rise-2">
        <Label>The thermostat — what you let yourself have</Label>
        <p className="text-sm mb-4" style={{ color: "var(--v2-muted)" }}>
          Tony's idea: each area has a setpoint. Go past it and you quietly sabotage back down to it. Willpower won't hold a new level — only conditioning does. So name where it sits, where it should be, and the daily rep that resets it.
        </p>
        <div className="space-y-3">
          {areas.map((a) => (
            <div
              key={a.id}
              className="rounded-2xl p-3.5"
              style={{ background: "var(--v2-glass)", border: "1px solid var(--v2-line)" }}
            >
              <input
                value={a.area}
                onChange={(e) => editArea(a.id!, "area", e.target.value)}
                onBlur={() => persistArea(a)}
                placeholder="Area — e.g. Money, Health, Work"
                className="w-full bg-transparent text-[15px] font-medium focus:outline-none mb-2.5"
                style={{ color: "var(--v2-ink)" }}
              />
              <div className="space-y-2">
                <Field value={a.current} onChange={(v) => editArea(a.id!, "current", v)} onBlur={() => persistArea(a)} placeholder="Where it sits now — honestly" multiline rows={2} />
                <Field value={a.target} onChange={(v) => editArea(a.id!, "target", v)} onBlur={() => persistArea(a)} placeholder="Where it should be" multiline rows={2} />
                <Field value={a.conditioning ?? ""} onChange={(v) => editArea(a.id!, "conditioning", v)} onBlur={() => persistArea(a)} placeholder="The daily rep that raises it — so you don't forget to condition" multiline rows={2} />
              </div>
              <button onClick={() => removeArea(a.id!)} className="text-[11px] mt-2.5 v2-press" style={{ color: "var(--v2-faint)" }}>
                Remove area
              </button>
            </div>
          ))}
          {areas.length === 0 && (
            <p className="text-sm" style={{ color: "var(--v2-muted)" }}>No areas yet. Add the ones where you sense a ceiling.</p>
          )}
        </div>
        <div className="mt-3">
          <Btn onClick={addArea}>+ Add an area</Btn>
        </div>
      </Card>

      {/* Beliefs */}
      <Card className="p-5 mb-4 v2-rise v2-rise-3">
        <div className="flex items-center justify-between mb-1">
          <Label>Beliefs you're changing</Label>
          <button onClick={() => setAddingBelief((v) => !v)} className="text-xs v2-press" style={{ color: "var(--v2-accent)" }}>
            {addingBelief ? "Cancel" : "+ Add"}
          </button>
        </div>

        {addingBelief && (
          <div className="mb-4 space-y-2.5 pt-2">
            <div className="flex flex-wrap gap-1.5">
              {DOMAINS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => setNbDomain(d.key)}
                  className="text-[11px] px-2.5 py-1 rounded-full v2-press"
                  style={{
                    background: nbDomain === d.key ? "var(--v2-accent-soft)" : "rgba(255,255,255,0.05)",
                    color: nbDomain === d.key ? "var(--v2-accent)" : "var(--v2-faint)",
                    border: "1px solid var(--v2-line)",
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <Field value={nbLimiting} onChange={setNbLimiting} placeholder="The limiting belief — “I…”" multiline rows={2} />
            <Field value={nbEmpowering} onChange={setNbEmpowering} placeholder="The empowering replacement" multiline rows={2} />
            <Btn variant="primary" onClick={submitBelief}>Add belief</Btn>
          </div>
        )}

        {beliefs.length === 0 && !addingBelief && (
          <p className="text-sm mt-1" style={{ color: "var(--v2-muted)" }}>
            Nothing yet. Sessions surface these as you work — or add one above.
          </p>
        )}

        <ul className="space-y-4 mt-2">
          {beliefs.map((b) => {
            const domain = DOMAINS.find((d) => d.key === b.domain);
            const st = streakFromDates(b.conditionedDates ?? []);
            const rv = review?.beliefs.find((x) => x.id === b.id);
            return (
              <li key={b.id} className="pt-1 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  {b.limiting && (
                    <p className="text-sm line-through" style={{ color: "var(--v2-faint)" }}>{b.limiting}</p>
                  )}
                  <p className="text-[15px] leading-snug font-medium mt-0.5">{b.empowering || "(no replacement yet)"}</p>
                  <p className="text-[11px] mt-1" style={{ color: "var(--v2-faint)" }}>
                    {domain?.label}
                    {st > 0 && `${domain ? " · " : ""}conditioned ${st} day${st > 1 ? "s" : ""} running`}
                  </p>
                  {rv && rv.note && (
                    <p
                      className="text-[12px] mt-1.5 leading-snug"
                      style={{ color: rv.verdict === "solid" ? "var(--v2-accent)" : "#e6b07a" }}
                    >
                      {rv.verdict === "solid" ? "✓ " : "rethink — "}
                      {rv.note}
                    </p>
                  )}
                </div>
                <button onClick={() => archive(b)} className="v2-press text-sm shrink-0" style={{ color: "var(--v2-faint)" }} aria-label="Remove">✕</button>
              </li>
            );
          })}
        </ul>

        {/* Coach's big-picture read of the set */}
        <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--v2-line)" }}>
          {review ? (
            <>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Coach&apos;s read</Label>
                <button onClick={runReview} disabled={reviewing} className="text-xs v2-press disabled:opacity-40" style={{ color: "var(--v2-accent)" }}>
                  {reviewing ? "Reviewing…" : "Re-review"}
                </button>
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--v2-muted)" }}>{review.overall}</p>
              <p className="text-[10px] mt-2" style={{ color: "var(--v2-faint)" }}>Reviewed {ageLabel(review.generatedAt)} · notes show under each belief above</p>
            </>
          ) : (
            <button
              onClick={runReview}
              disabled={reviewing || beliefs.length === 0}
              className="text-sm v2-press disabled:opacity-40"
              style={{ color: "var(--v2-accent)" }}
            >
              {reviewing ? "Reviewing…" : "✦ Have the coach review these — are they the right things, framed right?"}
            </button>
          )}
        </div>
      </Card>

      {/* Values */}
      <Card className="p-5 mb-4 v2-rise v2-rise-4">
        <Label>Values — what actually drives you</Label>
        <ul className="space-y-2 mt-2 mb-4">
          {values.map((v, i) => (
            <li key={v.id} className="flex items-start gap-3">
              <span className="text-sm tabular-nums w-5 shrink-0" style={{ color: "var(--v2-faint)" }}>{i + 1}.</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{v.name}</p>
                {v.rule && <p className="text-[11px]" style={{ color: "var(--v2-faint)" }}>{v.rule}</p>}
              </div>
              {i !== 0 && (
                <button onClick={() => makeTop(v)} className="text-[11px] v2-press" style={{ color: "var(--v2-faint)" }}>★ top</button>
              )}
              <button onClick={() => delValue(v)} className="text-[11px] v2-press" style={{ color: "var(--v2-faint)" }}>✕</button>
            </li>
          ))}
          {values.length === 0 && <li className="text-sm" style={{ color: "var(--v2-muted)" }}>Add the values you want running your choices.</li>}
        </ul>
        <div className="space-y-2.5">
          <Field value={newValue} onChange={setNewValue} placeholder="A value — e.g. Contribution" />
          <Field value={newRule} onChange={setNewRule} placeholder="Optional rule — “I honor this when…”" />
          <Btn onClick={addValue}>+ Add value</Btn>
        </div>
      </Card>
    </div>
  );
}
