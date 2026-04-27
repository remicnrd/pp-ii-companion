#!/usr/bin/env python3
"""Convert YouTube auto-generated VTT subtitles to clean plain text.

YouTube auto-captions are noisy: rolling-window duplicates, inline timing
tags like <00:00:01.520><c>word</c>, and per-word colorization. This script
strips all of that and produces a single readable paragraph stream per file.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

TIMING_TAG = re.compile(r"<\d{2}:\d{2}:\d{2}\.\d{3}>")
C_TAG = re.compile(r"</?c[^>]*>")
TIMESTAMP_LINE = re.compile(r"^\d{2}:\d{2}:\d{2}\.\d{3}\s+-->")


def clean_vtt(vtt_path: Path) -> str:
    raw = vtt_path.read_text(encoding="utf-8", errors="replace")
    lines = raw.splitlines()

    cleaned: list[str] = []
    seen: set[str] = set()

    for line in lines:
        if not line.strip():
            continue
        if line.startswith("WEBVTT") or line.startswith("Kind:") or line.startswith("Language:"):
            continue
        if TIMESTAMP_LINE.match(line):
            continue
        if "align:" in line and "position:" in line:
            continue

        line = TIMING_TAG.sub("", line)
        line = C_TAG.sub("", line)
        line = line.strip()
        if not line:
            continue
        # Skip exact rolling-window duplicates (YouTube emits each caption twice).
        if line in seen:
            continue
        seen.add(line)
        cleaned.append(line)

    text = " ".join(cleaned)
    text = re.sub(r"\s+", " ", text).strip()
    # Soft-wrap at ~100 chars for readability without breaking sentences.
    out_lines: list[str] = []
    buf = ""
    for word in text.split(" "):
        if len(buf) + len(word) + 1 > 100:
            out_lines.append(buf)
            buf = word
        else:
            buf = f"{buf} {word}".strip()
    if buf:
        out_lines.append(buf)
    return "\n".join(out_lines) + "\n"


def main() -> int:
    transcripts_dir = Path(__file__).resolve().parent.parent / "transcripts"
    vtts = sorted(transcripts_dir.glob("*.en.vtt"))
    if not vtts:
        print("No .en.vtt files found in transcripts/", file=sys.stderr)
        return 1

    for vtt in vtts:
        out = vtt.with_suffix("").with_suffix(".txt")  # .en.vtt -> .en.txt? no — .vtt -> .txt
        # actually .with_suffix twice gives weird results, do it manually:
        out = transcripts_dir / (vtt.name.removesuffix(".en.vtt") + ".txt")
        text = clean_vtt(vtt)
        out.write_text(text, encoding="utf-8")
        print(f"  {vtt.name} -> {out.name} ({len(text):,} chars)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
