"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { streamMessage } from "@/lib/llm";
import { getV2Settings, vdb } from "@/lib/v2/db";
import { buildV2CoachSystem, suggestedPrompts } from "@/lib/v2/coach";
import type { CoachMessageV2 } from "@/lib/v2/types";
import { Label } from "@/components/v2/ui";

export default function V2Coach() {
  const [messages, setMessages] = useState<CoachMessageV2[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamed, setStreamed] = useState("");
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [prompts, setPrompts] = useState<string[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const all = await vdb().coachMessages.orderBy("createdAt").toArray();
      setMessages(all);
      const s = await getV2Settings();
      setHasKey(!!s.apiKey);
      const beliefs = await vdb().beliefs.count();
      setPrompts(suggestedPrompts(beliefs > 0));
    })();
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamed]);

  async function send(text: string) {
    const t = text.trim();
    if (!t || streaming) return;
    const settings = await getV2Settings();
    if (!settings.apiKey) return;

    const userMsg: CoachMessageV2 = { role: "user", content: t, createdAt: Date.now() };
    const id = await vdb().coachMessages.add(userMsg);
    const withId = { ...userMsg, id: id as number };
    setMessages((m) => [...m, withId]);
    setInput("");
    setStreaming(true);
    setStreamed("");

    const system = await buildV2CoachSystem();
    const history = [...messages, withId].map((m) => ({ role: m.role, content: m.content }));

    let acc = "";
    await streamMessage(
      { apiKey: settings.apiKey, baseURL: settings.baseURL, model: settings.model },
      { system, messages: history },
      {
        onText: (chunk) => {
          acc += chunk;
          setStreamed(acc);
        },
        onDone: async (full) => {
          const asst: CoachMessageV2 = { role: "assistant", content: full, createdAt: Date.now() };
          const aid = await vdb().coachMessages.add(asst);
          setMessages((m) => [...m, { ...asst, id: aid as number }]);
          setStreamed("");
          setStreaming(false);
        },
        onError: (err) => {
          setStreamed("");
          setStreaming(false);
          alert("Error: " + err.message);
        },
      },
    );
  }

  async function clearHistory() {
    if (!confirm("Clear this conversation?")) return;
    await vdb().coachMessages.clear();
    setMessages([]);
  }

  if (hasKey === null) return <div className="px-5 pt-20 text-center" style={{ color: "var(--v2-faint)" }}>…</div>;

  if (!hasKey) {
    return (
      <div className="max-w-md mx-auto px-5 pt-16">
        <Label>Coach</Label>
        <h1 className="text-2xl font-semibold tracking-tight mb-3">Add your API key</h1>
        <p className="text-sm mb-6" style={{ color: "var(--v2-muted)" }}>
          The coach runs from your browser with your own key. Everything else in here works without it.
        </p>
        <Link href="/v2/setup" className="text-sm v2-press" style={{ color: "var(--v2-accent)" }}>Open settings →</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-7rem)] max-w-md mx-auto">
      <header className="px-5 pt-6 pb-3 flex items-baseline justify-between">
        <div>
          <Label>Coach</Label>
          <h1 className="text-xl font-semibold tracking-tight">Think it through</h1>
        </div>
        {messages.length > 0 && (
          <button onClick={clearHistory} className="text-[11px] v2-press" style={{ color: "var(--v2-faint)" }}>Clear</button>
        )}
      </header>

      <div ref={scroller} className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="pt-6">
            <p className="text-sm mb-4" style={{ color: "var(--v2-faint)" }}>It knows your self-model and where you are. Start anywhere.</p>
            <div className="space-y-2">
              {prompts.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="block w-full text-left text-sm rounded-2xl px-4 py-3 v2-press"
                  style={{ background: "var(--v2-glass)", border: "1px solid var(--v2-line)", color: "var(--v2-ink)" }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className="rounded-2xl px-4 py-2.5 max-w-[88%] text-sm leading-relaxed whitespace-pre-wrap"
              style={
                m.role === "user"
                  ? { background: "var(--v2-accent-soft)", color: "var(--v2-ink)", border: "1px solid var(--v2-line)" }
                  : { background: "var(--v2-glass)", color: "var(--v2-ink)", border: "1px solid var(--v2-line)" }
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {streaming && !streamed && (
          <div className="rounded-2xl px-4 py-2.5 max-w-[88%] text-sm inline-flex items-center gap-2" style={{ background: "var(--v2-glass)", border: "1px solid var(--v2-line)", color: "var(--v2-faint)" }}>
            <span className="thinking-dots"><span /><span /><span /></span>
          </div>
        )}
        {streaming && streamed && (
          <div className="rounded-2xl px-4 py-2.5 max-w-[88%] text-sm leading-relaxed whitespace-pre-wrap" style={{ background: "var(--v2-glass)", border: "1px solid var(--v2-line)", color: "var(--v2-ink)" }}>
            {streamed}
            <span className="inline-block w-1 h-4 align-middle ml-0.5 animate-pulse" style={{ background: "var(--v2-faint)" }} />
          </div>
        )}
      </div>

      <div className="px-3 pb-3 pt-2">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.metaKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder="What's on your mind?"
            rows={1}
            className="flex-1 rounded-2xl px-4 py-2.5 text-sm leading-relaxed max-h-32 resize-none focus:outline-none"
            style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--v2-line)", color: "var(--v2-ink)" }}
          />
          <button
            disabled={streaming || !input.trim()}
            onClick={() => send(input)}
            className="v2-press px-4 py-2.5 rounded-2xl text-sm font-medium disabled:opacity-40"
            style={{ background: "var(--v2-ink)", color: "#0a0a0a" }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
