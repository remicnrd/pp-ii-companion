#!/usr/bin/env bash
set -euo pipefail

# Personal Power II — fetch audio + transcripts for the whole playlist
# Output:
#   audio/Day-XX-<title>.mp3
#   transcripts/Day-XX-<title>.en.vtt   (raw, from YouTube auto-captions)
#   transcripts/Day-XX-<title>.txt      (cleaned plain text — generated separately)

PLAYLIST="https://www.youtube.com/playlist?list=PLGhSYlzW_1KWhxAJGU5a9iH300UkPqDS3"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"

echo "==> Downloading audio (mp3) for all videos…"
yt-dlp \
  --extract-audio --audio-format mp3 --audio-quality 0 \
  --embed-metadata \
  --output "audio/Day-%(playlist_index)02d-%(title)s.%(ext)s" \
  --restrict-filenames \
  --ignore-errors \
  --no-overwrites \
  "$PLAYLIST"

echo "==> Downloading auto-generated English subtitles…"
yt-dlp \
  --skip-download \
  --write-auto-subs --sub-lang en --sub-format vtt \
  --output "transcripts/Day-%(playlist_index)02d-%(title)s.%(ext)s" \
  --restrict-filenames \
  --ignore-errors \
  --no-overwrites \
  "$PLAYLIST"

echo "==> Done."
