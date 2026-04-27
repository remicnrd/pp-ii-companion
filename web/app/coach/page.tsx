"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { db, getSettings } from "@/lib/db";
import { streamMessage } from "@/lib/llm";
import { buildCoachSystem } from "@/lib/coach";
import type { ChatMessage } from "@/lib/types";

export default function CoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamed, setStreamed] = useState("");
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const all = await db().chatMessages.orderBy("createdAt").toArray();
      setMessages(all);
      const s = await getSettings();
      setHasKey(!!s.apiKey);
    })();
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamed]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    const settings = await getSettings();
    if (!settings.apiKey) {
      alert("Add your API key in Setup.");
      return;
    }

    const userMsg: ChatMessage = { role: "user", content: text, createdAt: Date.now() };
    const id = await db().chatMessages.add(userMsg);
    const userWithId = { ...userMsg, id: id as number };
    setMessages((m) => [...m, userWithId]);
    setInput("");
    setStreaming(true);
    setStreamed("");

    const system = await buildCoachSystem();
    const history = [...messages, userWithId].map((m) => ({
      role: m.role,
      content: m.content,
    }));

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
          const asst: ChatMessage = { role: "assistant", content: full, createdAt: Date.now() };
          const aid = await db().chatMessages.add(asst);
          setMessages((m) => [...m, { ...asst, id: aid as number }]);
          setStreamed("");
          setStreaming(false);
        },
        onError: (err) => {
          alert("Error: " + err.message);
          setStreamed("");
          setStreaming(false);
        },
      },
    );
  }

  async function saveMemoryFromMessage(content: string) {
    const text = prompt("What should the Coach remember? (edit if you want)", content);
    if (!text) return;
    await db().memories.add({ text, createdAt: Date.now() });
    alert("Saved.");
  }

  async function clearHistory() {
    if (!confirm("Clear all chat history? Memories are kept.")) return;
    await db().chatMessages.clear();
    setMessages([]);
  }

  if (hasKey === null) {
    return <div className="p-6 text-faint">Loading…</div>;
  }

  if (!hasKey) {
    return (
      <div className="max-w-2xl mx-auto px-5 pt-12 pb-8">
        <p className="text-xs uppercase tracking-widest text-faint mb-2">Coach</p>
        <h1 className="text-3xl font-semibold tracking-tight mb-4">Add your API key first</h1>
        <p className="text-sm text-muted mb-6">
          The Coach calls the LLM directly from your browser using your own API key. Add it in Setup.
        </p>
        <Link href="/setup" className="inline-flex items-center px-4 py-2 rounded-lg bg-accent text-accent-ink text-sm font-medium">
          Open Setup →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-5rem)] max-w-2xl mx-auto">
      <header className="px-5 pt-6 pb-3 flex items-baseline justify-between border-b border-line">
        <div>
          <p className="text-xs uppercase tracking-widest text-faint">Coach</p>
          <h1 className="text-xl font-semibold tracking-tight">Talk it through</h1>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearHistory}
            className="text-[11px] text-faint hover:text-ink"
          >
            Clear
          </button>
        )}
      </header>

      <div ref={scroller} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && !streaming && (
          <div className="text-sm text-faint mt-12 text-center px-6">
            Ask anything. The Coach has the full program, your profile, and your commitments.
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
            <div
              className={`rounded-2xl px-4 py-2.5 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-accent text-accent-ink"
                  : "bg-elevate-soft border border-line"
              }`}
            >
              {m.content}
              {m.role === "assistant" && (
                <div className="mt-2">
                  <button
                    onClick={() => saveMemoryFromMessage(m.content.slice(0, 200))}
                    className="text-[11px] text-faint hover:text-ink"
                  >
                    Save as memory
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
        {streaming && streamed && (
          <div className="rounded-2xl px-4 py-2.5 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap bg-elevate-soft border border-line">
            {streamed}
            <span className="inline-block w-1 h-4 bg-faint align-middle ml-0.5 animate-pulse" />
          </div>
        )}
      </div>

      <div className="px-3 pb-3 pt-2 border-t border-line">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.metaKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="What's on your mind?"
            className="flex-1 bg-page border border-line rounded-2xl px-4 py-2.5 text-sm leading-relaxed max-h-32 resize-none focus:outline-none focus:border-ink/30"
            rows={1}
          />
          <button
            disabled={streaming || !input.trim()}
            onClick={send}
            className="px-4 py-2.5 rounded-2xl bg-accent text-accent-ink text-sm font-medium disabled:opacity-40"
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
