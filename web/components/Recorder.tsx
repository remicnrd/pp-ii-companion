"use client";

import { useRef, useState } from "react";
import { transcribeAudio } from "@/lib/llm";

type Status = "idle" | "recording" | "transcribing";

export function Recorder({
  apiKey,
  baseURL,
  onTranscript,
}: {
  apiKey: string;
  baseURL?: string;
  onTranscript: (text: string) => void;
}) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const tickRef = useRef<number | null>(null);

  function pickMime(): string | undefined {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"];
    for (const m of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m)) return m;
    }
    return undefined;
  }

  async function start() {
    setError(null);
    if (!apiKey) {
      setError("Add your API key first (above).");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setError("Your browser doesn't support MediaRecorder. Try a desktop browser.");
      return;
    }
    if (!window.isSecureContext) {
      setError("Recording requires HTTPS or localhost.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMime();
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onerror = (e) => {
        const message = (e as unknown as { error?: { message?: string } }).error?.message;
        setError(`Recorder error: ${message ?? "unknown"}`);
        cleanup();
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        cleanup();
        if (blob.size === 0) {
          setError("No audio captured.");
          setStatus("idle");
          return;
        }
        runTranscription(blob, mr.mimeType);
      };
      mr.start(1000);
      recRef.current = mr;
      startedAtRef.current = Date.now();
      setElapsed(0);
      tickRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
      }, 250);
      setStatus("recording");
    } catch (err) {
      const e = err as Error;
      if (e.name === "NotAllowedError") {
        setError("Microphone permission was blocked. Allow it in browser settings and try again.");
      } else if (e.name === "NotFoundError") {
        setError("No microphone found.");
      } else {
        setError("Couldn't start recording: " + e.message);
      }
    }
  }

  function cleanup() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recRef.current = null;
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }

  function stop() {
    try {
      recRef.current?.stop();
    } catch {
      cleanup();
      setStatus("idle");
    }
  }

  async function runTranscription(blob: Blob, mime: string) {
    setStatus("transcribing");
    try {
      const ext =
        mime.includes("mp4") ? "mp4" : mime.includes("ogg") ? "ogg" : "webm";
      const text = await transcribeAudio({ apiKey, baseURL }, blob, `recording.${ext}`);
      const trimmed = text.trim();
      if (trimmed) onTranscript(trimmed);
      else setError("Transcription returned empty.");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(
        message.toLowerCase().includes("transcrip") ||
          message.toLowerCase().includes("audio") ||
          message.toLowerCase().includes("not found")
          ? `Transcription failed: ${message}. Note: this requires OpenAI directly — OpenRouter typically doesn't support /audio/transcriptions.`
          : `Transcription failed: ${message}`,
      );
    } finally {
      setStatus("idle");
    }
  }

  const min = Math.floor(elapsed / 60);
  const sec = (elapsed % 60).toString().padStart(2, "0");

  return (
    <div>
      <div className="flex items-center gap-3 flex-wrap">
        {status === "idle" && (
          <button
            onClick={start}
            className="px-3 py-2 rounded-lg bg-elevate border border-line text-sm"
          >
            ● Start recording
          </button>
        )}
        {status === "recording" && (
          <>
            <button
              onClick={stop}
              className="px-3 py-2 rounded-lg bg-danger text-accent-ink text-sm"
            >
              ■ Stop & transcribe
            </button>
            <span className="text-xs text-faint inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-danger animate-pulse" />
              {min}:{sec}
            </span>
          </>
        )}
        {status === "transcribing" && (
          <span className="text-sm text-muted">Transcribing…</span>
        )}
      </div>
      {error && <div className="text-xs text-danger mt-2">{error}</div>}
    </div>
  );
}
