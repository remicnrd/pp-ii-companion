"use client";

import { useEffect, useState, type ReactNode } from "react";

// SHA-256 hash of the access password, set at build time via APP_PASSWORD env var.
// Empty string = no gate (fully open access).
const HASH = (process.env.NEXT_PUBLIC_APP_PASSWORD_HASH || "").toLowerCase();
const STORAGE_KEY = "ppii.unlocked";

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function PasswordGate({ children }: { children: ReactNode }) {
  const gated = !!HASH;
  const [unlocked, setUnlocked] = useState(!gated);
  const [checking, setChecking] = useState(gated);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!gated) return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === HASH) setUnlocked(true);
    } catch {
      /* ignore */
    }
    setChecking(false);
  }, [gated]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const hash = await sha256(input.trim());
      if (hash === HASH) {
        localStorage.setItem(STORAGE_KEY, HASH);
        setUnlocked(true);
      } else {
        setError("Wrong password.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) return null;
  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-page text-ink">
      <form onSubmit={submit} className="w-full max-w-sm">
        <p className="text-xs uppercase tracking-widest text-faint mb-2">Personal Power II</p>
        <h1 className="text-2xl font-semibold tracking-tight mb-6">Locked</h1>
        <label className="block text-sm text-muted mb-2">Access password</label>
        <input
          type="password"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full bg-page border border-line rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-ink/30 mb-3"
        />
        <button
          type="submit"
          disabled={submitting || !input}
          className="w-full px-4 py-2.5 rounded-lg bg-accent text-accent-ink text-sm font-medium disabled:opacity-50"
        >
          {submitting ? "Checking…" : "Unlock"}
        </button>
        {error && <p className="text-xs text-danger mt-3">{error}</p>}
      </form>
    </div>
  );
}
