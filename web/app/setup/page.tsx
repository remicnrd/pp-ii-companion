"use client";

import { useEffect, useState } from "react";
import { getSettings, getProfile, saveSettings, saveProfile } from "@/lib/db";
import { oneShot, DEFAULT_BASE_URL, DEFAULT_MODEL } from "@/lib/llm";
import { loadDaysIndex, audioUrlForDay } from "@/lib/program";
import { getStoredTheme, setStoredTheme } from "@/components/ThemeProvider";
import { Recorder } from "@/components/Recorder";
import type { Settings, Profile } from "@/lib/types";

type Theme = "system" | "light" | "dark";

export default function SetupPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [model, setModel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [downloading, setDownloading] = useState<{ done: number; total: number } | null>(null);
  const [intake, setIntake] = useState("");
  const [generating, setGenerating] = useState(false);
  const [theme, setThemeState] = useState<Theme>("system");
  const [savedFlash, setSavedFlash] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addText, setAddText] = useState("");

  useEffect(() => {
    (async () => {
      const s = await getSettings();
      const p = await getProfile();
      setSettings(s);
      setProfile(p ?? null);
      setApiKey(s.apiKey ?? "");
      setBaseURL(s.baseURL ?? "");
      setModel(s.model ?? "");
      setStartDate(s.startDate ?? new Date().toISOString().slice(0, 10));
      setIntake(p?.rawIntake ?? "");
      setThemeState(getStoredTheme());
    })();
  }, []);

  function flash(msg: string) {
    setSavedFlash(msg);
    setTimeout(() => setSavedFlash(""), 1600);
  }

  async function handleSaveSettings() {
    await saveSettings({
      apiKey: apiKey.trim() || undefined,
      baseURL: baseURL.trim() || undefined,
      model: model.trim() || undefined,
      startDate,
    });
    flash("Saved.");
  }

  async function downloadAllAudio() {
    const idx = await loadDaysIndex();
    const urls = idx.days
      .map((d) => audioUrlForDay(d))
      .filter((u): u is string => !!u);
    setDownloading({ done: 0, total: urls.length });
    for (let i = 0; i < urls.length; i++) {
      try {
        await fetch(urls[i], { cache: "force-cache" });
      } catch {
        /* ignore individual failures */
      }
      setDownloading({ done: i + 1, total: urls.length });
    }
    setTimeout(() => setDownloading(null), 1500);
    flash("Audio downloaded.");
  }

  async function distillFromIntake(text: string): Promise<string> {
    return oneShot({ apiKey, baseURL, model }, {
      system: `You are helping a user build a personal profile that will be used as background context for an AI coach guiding them through Tony Robbins' Personal Power II program.

The user has provided raw intake (free-form thoughts, possibly transcribed from voice). Distill it into a tight personal profile (250-400 words) covering:

- Who they are, what they do, and what their highest-lever work is right now
- Their stated goals from the program
- What's genuinely in the way (be honest, don't soften)
- Anything specific the Coach should remember (constraints, sensitivities, identity facts)

Write in second person ("you are…", "your highest-lever work is…"). Be specific, direct, no fluff. Skip generic encouragement. Skip motivational language. Match a sharp friend taking notes — not a wellness coach.`,
      user: text,
    });
  }

  async function handleGenerateProfile() {
    if (!apiKey.trim()) {
      alert("Add your API key first.");
      return;
    }
    if (!intake.trim()) {
      alert("Write or record some intake first.");
      return;
    }
    setGenerating(true);
    try {
      const summary = (await distillFromIntake(intake)).trim();
      if (!summary) {
        alert(
          "The model returned an empty profile (often a token-budget issue). Try again or switch model in Setup → API key → Advanced.",
        );
        return;
      }
      await saveProfile({ rawIntake: intake, generatedSummary: summary });
      const p = await getProfile();
      setProfile(p ?? null);
      flash("Profile generated.");
    } catch (err) {
      alert("Failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setGenerating(false);
    }
  }

  async function handleAddToProfile() {
    if (!addText.trim()) {
      alert("Add some new content first.");
      return;
    }
    if (!apiKey.trim()) {
      alert("Add your API key first.");
      return;
    }
    setGenerating(true);
    try {
      const merged =
        (intake ? intake.replace(/\s+$/, "") + "\n\n--- additional ---\n" : "") +
        addText.trim();
      const summary = (await distillFromIntake(merged)).trim();
      if (!summary) {
        alert("The model returned an empty profile. Try again.");
        return;
      }
      await saveProfile({ rawIntake: merged, generatedSummary: summary });
      const p = await getProfile();
      setProfile(p ?? null);
      setIntake(merged);
      setAddText("");
      setAddOpen(false);
      flash("Profile updated.");
    } catch (err) {
      alert("Failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setGenerating(false);
    }
  }

  async function handleClearProfile() {
    if (!confirm("Clear your profile and intake? This wipes your distilled profile and the raw text.")) return;
    await saveProfile({ rawIntake: "", generatedSummary: "" });
    setProfile(null);
    setIntake("");
    setAddText("");
    setAddOpen(false);
    flash("Cleared.");
  }

  function appendTranscript(text: string) {
    setIntake((current) => (current ? current.replace(/\s+$/, "") + "\n\n" + text : text));
  }

  function appendAddTranscript(text: string) {
    setAddText((current) => (current ? current.replace(/\s+$/, "") + "\n\n" + text : text));
  }

  if (!settings) {
    return <div className="p-6 text-faint">Loading…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-5 pt-10 pb-8">
      <header className="mb-8">
        <p className="text-xs uppercase tracking-widest text-faint mb-2">Setup</p>
        <h1 className="text-3xl font-semibold tracking-tight">Set yourself up</h1>
      </header>

      {savedFlash && (
        <div className="fixed top-4 right-4 z-50 bg-elevate border border-line text-ink px-3 py-1.5 rounded-md text-sm shadow">
          {savedFlash}
        </div>
      )}

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Theme</h2>
        <div className="flex gap-2">
          {(["system", "light", "dark"] as Theme[]).map((t) => (
            <button
              key={t}
              onClick={() => {
                setThemeState(t);
                setStoredTheme(t);
              }}
              className={`px-3 py-1.5 rounded-md text-sm capitalize border ${
                theme === t
                  ? "bg-accent text-accent-ink border-accent"
                  : "bg-elevate-soft border-line text-muted"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">API key</h2>
        <p className="text-sm text-muted mb-3">
          Stored in your browser only — never leaves this device. Default is OpenAI; for OpenRouter or another OpenAI-compatible provider, set the base URL below.
        </p>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-…"
          className="w-full bg-page border border-line rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-ink/30 mb-3"
        />

        <details className="text-sm">
          <summary className="cursor-pointer text-faint">
            <span className="chev mr-1.5 text-xs">▶</span>
            Advanced — base URL & model
          </summary>
          <div className="pt-3 space-y-3">
            <div>
              <label className="block text-xs uppercase tracking-widest text-faint mb-1.5">Base URL</label>
              <input
                type="text"
                value={baseURL}
                onChange={(e) => setBaseURL(e.target.value)}
                placeholder={DEFAULT_BASE_URL}
                className="w-full bg-page border border-line rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-ink/30"
              />
              <p className="text-xs text-faint mt-1">
                Leave blank for OpenAI. For OpenRouter use <code>https://openrouter.ai/api/v1</code>.
              </p>
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-faint mb-1.5">Model</label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={DEFAULT_MODEL}
                className="w-full bg-page border border-line rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-ink/30"
              />
              <p className="text-xs text-faint mt-1">
                Default: <code>{DEFAULT_MODEL}</code>. For OpenRouter, use prefixed names like <code>anthropic/claude-sonnet-4.5</code>.
              </p>
            </div>
          </div>
        </details>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Start date</h2>
        <p className="text-sm text-muted mb-3">
          When did (or will) you start? Coach uses this to know if you're on track.
        </p>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="bg-page border border-line rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-ink/30"
        />
      </section>

      <button
        onClick={handleSaveSettings}
        className="mb-10 px-4 py-2 rounded-lg bg-accent text-accent-ink text-sm font-medium"
      >
        Save key + date
      </button>

      <section className="mb-10 pt-6 border-t border-line">
        <h2 className="text-lg font-semibold mb-2">Offline audio</h2>
        <p className="text-sm text-muted mb-3">
          Download all 20 sessions (~820 MB) for offline listening on the go.
        </p>
        <button
          disabled={!!downloading}
          onClick={downloadAllAudio}
          className="px-4 py-2 rounded-lg bg-elevate border border-line text-sm font-medium disabled:opacity-50"
        >
          {downloading
            ? `Downloading ${downloading.done}/${downloading.total}…`
            : "↓ Download full program"}
        </button>
        {downloading && (
          <div className="mt-3 h-1.5 bg-elevate rounded-full overflow-hidden border border-line">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${(downloading.done / downloading.total) * 100}%` }}
            />
          </div>
        )}
      </section>

      <section className="mb-8 pt-6 border-t border-line">
        <h2 className="text-lg font-semibold mb-2">Your profile</h2>
        <p className="text-sm text-muted mb-3">
          Tell the Coach who you are, what you do, what you want from this program, and what's actually in the way. Speak it or type it. We'll distill it.
        </p>

        {!profile?.generatedSummary && (
          <>
            <div className="mb-3">
              <Recorder
                apiKey={apiKey}
                baseURL={baseURL}
                onTranscript={appendTranscript}
              />
              <p className="text-xs text-faint mt-2">
                Records via your mic, then transcribes through OpenAI Whisper. Your audio is sent to OpenAI; the transcript appends below.
              </p>
            </div>

            <textarea
              value={intake}
              onChange={(e) => setIntake(e.target.value)}
              placeholder="Who are you, what's the highest-lever work you're doing, what do you want out of this 30 days, and what's actually getting in the way?"
              className="w-full bg-page border border-line rounded-lg px-3 py-3 text-sm leading-relaxed min-h-[160px] focus:outline-none focus:border-ink/30"
            />

            <button
              disabled={generating}
              onClick={handleGenerateProfile}
              className="mt-3 px-4 py-2 rounded-lg bg-accent text-accent-ink text-sm font-medium disabled:opacity-50"
            >
              {generating ? "Distilling…" : "Generate profile"}
            </button>
          </>
        )}

        {profile?.generatedSummary && (
          <div className="rounded-2xl border border-line bg-elevate-soft p-4">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <p className="text-xs uppercase tracking-widest text-faint font-semibold">
                Distilled profile
              </p>
              <p className="text-[10px] text-faint">
                {new Date(profile.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed mb-4">
              {profile.generatedSummary}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={generating}
                onClick={handleGenerateProfile}
                className="px-3 py-1.5 rounded-md bg-elevate border border-line text-xs font-medium disabled:opacity-50"
              >
                {generating ? "Working…" : "↻ Redo from intake"}
              </button>
              <button
                disabled={generating}
                onClick={() => setAddOpen((o) => !o)}
                className="px-3 py-1.5 rounded-md bg-elevate border border-line text-xs font-medium disabled:opacity-50"
              >
                {addOpen ? "× Cancel add" : "+ Add to profile"}
              </button>
              <button
                onClick={handleClearProfile}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-danger hover:bg-elevate"
              >
                Clear profile
              </button>
            </div>

            {addOpen && (
              <div className="mt-4 pt-4 border-t border-line">
                <p className="text-xs text-faint mb-3">
                  Anything you want to add — new constraints, recent context, things the Coach should know now. Speak or type. We'll fold it into your profile.
                </p>
                <div className="mb-3">
                  <Recorder
                    apiKey={apiKey}
                    baseURL={baseURL}
                    onTranscript={appendAddTranscript}
                  />
                </div>
                <textarea
                  value={addText}
                  onChange={(e) => setAddText(e.target.value)}
                  placeholder="What changed, what's new, what should they remember?"
                  className="w-full bg-page border border-line rounded-lg px-3 py-3 text-sm leading-relaxed min-h-[100px] focus:outline-none focus:border-ink/30"
                />
                <button
                  disabled={generating || !addText.trim()}
                  onClick={handleAddToProfile}
                  className="mt-2 px-3 py-1.5 rounded-md bg-accent text-accent-ink text-xs font-medium disabled:opacity-50"
                >
                  {generating ? "Folding in…" : "Fold into profile"}
                </button>
              </div>
            )}

            <details className="mt-4 pt-4 border-t border-line">
              <summary className="text-xs text-faint cursor-pointer">
                <span className="chev mr-1.5 text-[10px]">▶</span>
                Show raw intake
              </summary>
              <div className="mt-3">
                <textarea
                  value={intake}
                  onChange={(e) => setIntake(e.target.value)}
                  className="w-full bg-page border border-line rounded-lg px-3 py-3 text-xs leading-relaxed min-h-[120px] font-mono focus:outline-none focus:border-ink/30"
                />
                <p className="text-[10px] text-faint mt-1">
                  Edit and click "Redo from intake" above to regenerate.
                </p>
              </div>
            </details>
          </div>
        )}
      </section>
    </div>
  );
}
