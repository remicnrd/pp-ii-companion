"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_BASE_URL } from "@/lib/llm";
import { loadDaysIndex, audioUrlForDay } from "@/lib/program";
import { getV2Settings, importKeyFromV1, saveV2Settings, vdb } from "@/lib/v2/db";
import { buildCoachMarkdown, V2_COACH_MODEL } from "@/lib/v2/coach";
import { Btn, Card, Field, Label } from "@/components/v2/ui";

export default function V2Setup() {
  const [loaded, setLoaded] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [model, setModel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [intent, setIntent] = useState("");
  const [flash, setFlash] = useState("");
  const [dl, setDl] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function toast(m: string) {
    setFlash(m);
    setTimeout(() => setFlash(""), 1600);
  }

  useEffect(() => {
    (async () => {
      let s = await getV2Settings();
      // Auto-pull the key from the v1 app if v2 doesn't have one yet, so it just
      // works without the user having to think about importing.
      if (!s.apiKey) {
        const imported = await importKeyFromV1();
        if (imported) s = await getV2Settings();
      }
      setApiKey(s.apiKey ?? "");
      setBaseURL(s.baseURL ?? "");
      setModel(s.model ?? "");
      setStartDate(s.startDate ?? new Date().toISOString().slice(0, 10));
      setIntent(s.intentName ?? "");
      setLoaded(true);
    })();
  }, []);

  async function save() {
    await saveV2Settings({
      apiKey: apiKey.trim() || undefined,
      baseURL: baseURL.trim() || undefined,
      model: model.trim() || undefined,
      startDate,
      intentName: intent.trim() || undefined,
    });
    toast("Saved.");
  }

  async function importKey() {
    const ok = await importKeyFromV1();
    if (ok) {
      const s = await getV2Settings();
      setApiKey(s.apiKey ?? "");
      setBaseURL(s.baseURL ?? "");
      setModel(s.model ?? "");
      toast("Imported from your current app.");
    } else {
      toast("No key found in the current app.");
    }
  }

  async function downloadAudio() {
    const idx = await loadDaysIndex();
    const urls = idx.days.map((d) => audioUrlForDay(d)).filter((u): u is string => !!u);
    setDl({ done: 0, total: urls.length });
    for (let i = 0; i < urls.length; i++) {
      try {
        await fetch(urls[i], { cache: "force-cache" });
      } catch {
        /* ignore */
      }
      setDl({ done: i + 1, total: urls.length });
    }
    setTimeout(() => setDl(null), 1000);
    toast("Audio cached.");
  }

  async function exportData() {
    const dump = {
      _app: "personal-power-ii-v2",
      _exportedAt: new Date().toISOString(),
      settings: await vdb().settings.toArray(),
      beliefs: await vdb().beliefs.toArray(),
      thermoAreas: await vdb().thermoAreas.toArray(),
      values: await vdb().values.toArray(),
      priming: await vdb().priming.toArray(),
      dayProgress: await vdb().dayProgress.toArray(),
      coachMessages: await vdb().coachMessages.toArray(),
    };
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ppii-v2-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function exportMarkdown() {
    toast("Building…");
    const md = await buildCoachMarkdown();
    const blob = new Blob([md], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ppii-context-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("Markdown exported.");
  }

  async function copyMarkdown() {
    try {
      const md = await buildCoachMarkdown();
      await navigator.clipboard.writeText(md);
      toast("Copied to clipboard.");
    } catch {
      toast("Couldn't copy — try Export.");
    }
  }

  async function importData(file: File) {
    if (!confirm("Import this backup? It merges into your current v2 data.")) return;
    try {
      const data = JSON.parse(await file.text());
      const d = vdb();
      if (data.settings) await d.settings.bulkPut(data.settings);
      if (data.beliefs) await d.beliefs.bulkPut(data.beliefs);
      if (data.thermoAreas) await d.thermoAreas.bulkPut(data.thermoAreas);
      if (data.values) await d.values.bulkPut(data.values);
      if (data.priming) await d.priming.bulkPut(data.priming);
      if (data.dayProgress) await d.dayProgress.bulkPut(data.dayProgress);
      if (data.coachMessages) await d.coachMessages.bulkPut(data.coachMessages);
      toast("Imported.");
    } catch {
      toast("Couldn't read that file.");
    }
  }

  if (!loaded) return <div className="px-5 pt-20 text-center" style={{ color: "var(--v2-faint)" }}>…</div>;

  return (
    <div className="max-w-md mx-auto px-5 pt-12">
      {flash && (
        <div className="fixed top-4 right-4 z-50 text-sm px-3 py-1.5 rounded-xl" style={{ background: "var(--v2-glass-strong)", border: "1px solid var(--v2-line)" }}>{flash}</div>
      )}
      <header className="mb-6 v2-rise">
        <Label>Settings</Label>
        <h1 className="text-[26px] font-semibold tracking-tight">Set up v2</h1>
        <p className="text-sm mt-1" style={{ color: "var(--v2-muted)" }}>Separate from your current app — nothing here touches it.</p>
      </header>

      <Card className="p-5 mb-4 v2-rise">
        <div className="flex items-center justify-between mb-2">
          <Label>API key (for Coach)</Label>
          <button onClick={importKey} className="text-xs v2-press" style={{ color: "var(--v2-accent)" }}>Import from current app</button>
        </div>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-…"
          className="w-full rounded-2xl px-3.5 py-3 text-sm font-mono focus:outline-none"
          style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--v2-line)", color: "var(--v2-ink)" }}
        />
        <details className="mt-3">
          <summary className="text-xs cursor-pointer" style={{ color: "var(--v2-faint)" }}>Advanced — base URL & model</summary>
          <div className="pt-3 space-y-2.5">
            <Field value={baseURL} onChange={setBaseURL} placeholder={DEFAULT_BASE_URL} />
            <Field value={model} onChange={setModel} placeholder={V2_COACH_MODEL} />
            <p className="text-[11px]" style={{ color: "var(--v2-faint)" }}>
              Coach defaults to <code>{V2_COACH_MODEL}</code> — current, reasons well, mid-cost. Leave blank to use it, or set e.g. <code>gpt-5-mini</code> for cheaper.
            </p>
          </div>
        </details>
      </Card>

      <Card className="p-5 mb-4 v2-rise v2-rise-2">
        <Label>Start date</Label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-2xl px-3.5 py-3 text-sm focus:outline-none"
          style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--v2-line)", color: "var(--v2-ink)", colorScheme: "dark" }}
        />
        <div className="mt-4">
          <Label>What you're working toward</Label>
          <Field value={intent} onChange={setIntent} placeholder="someone who finishes what they start" />
        </div>
      </Card>

      <div className="mb-5 v2-rise v2-rise-3">
        <Btn variant="primary" onClick={save} className="w-full">Save</Btn>
      </div>

      <Card className="p-5 mb-4 v2-rise v2-rise-4">
        <Label>Offline audio</Label>
        <p className="text-sm mb-3" style={{ color: "var(--v2-muted)" }}>Cache all sessions for offline listening (~360 MB). Shares the same cache as your current app.</p>
        <Btn onClick={downloadAudio} disabled={!!dl}>
          {dl ? `Downloading ${dl.done}/${dl.total}…` : "↓ Download all sessions"}
        </Btn>
      </Card>

      <Card className="p-5 mb-4 v2-rise">
        <Label>Backup</Label>
        <p className="text-sm mb-3" style={{ color: "var(--v2-muted)" }}>Your data lives only in this browser. Export a copy so a cleared cache or a new phone can't wipe it.</p>
        <div className="flex gap-2">
          <Btn onClick={exportData}>Export JSON</Btn>
          <Btn onClick={() => fileRef.current?.click()}>Import</Btn>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importData(f);
              e.target.value = "";
            }}
          />
        </div>
      </Card>

      <Card className="p-5 mb-4 v2-rise">
        <Label>Share with another AI</Label>
        <p className="text-sm mb-3" style={{ color: "var(--v2-muted)" }}>
          A Markdown brief of the whole program, your own session notes, and your self-model. Paste it into ChatGPT, Claude, or anything else to get a coach that already knows everything.
        </p>
        <div className="flex gap-2">
          <Btn variant="primary" onClick={copyMarkdown}>Copy context</Btn>
          <Btn onClick={exportMarkdown}>Download .md</Btn>
        </div>
      </Card>

      <div className="text-center mt-6">
        <Link href="/v2" className="text-xs v2-press" style={{ color: "var(--v2-faint)" }}>← Back to Today</Link>
      </div>
    </div>
  );
}
