"use client";

import { useEffect, useRef } from "react";

/**
 * Audio player wrapping a native <audio> element with full MediaSession wiring.
 * Why: iOS' lock-screen "Now Playing" play button only resumes a paused page
 * if we explicitly handle the `play` MediaSession action; otherwise iOS
 * dispatches a generic resume that the suspended page tab can't service.
 */
export function AudioPlayer({
  src,
  title,
  subtitle,
  artworkSrc,
  onPlayed,
}: {
  src: string;
  title: string;
  subtitle?: string;
  artworkSrc?: string;
  onPlayed?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return;

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title,
        artist: subtitle ?? "Personal Power II",
        album: "Personal Power II",
        artwork: artworkSrc
          ? [{ src: artworkSrc, sizes: "512x512", type: "image/png" }]
          : undefined,
      });
    } catch {
      /* ignore — older browsers */
    }

    const setHandler = (
      action: MediaSessionAction,
      handler: MediaSessionActionHandler | null,
    ) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        /* unsupported action */
      }
    };

    const SEEK_STEP = 15;

    setHandler("play", () => {
      void el.play();
    });
    setHandler("pause", () => {
      el.pause();
    });
    setHandler("seekbackward", (details) => {
      const offset = details.seekOffset ?? SEEK_STEP;
      el.currentTime = Math.max(0, el.currentTime - offset);
    });
    setHandler("seekforward", (details) => {
      const offset = details.seekOffset ?? SEEK_STEP;
      el.currentTime = Math.min(el.duration || el.currentTime, el.currentTime + offset);
    });
    setHandler("seekto", (details) => {
      if (typeof details.seekTime === "number") {
        if (details.fastSeek && "fastSeek" in el) {
          (el as HTMLAudioElement & { fastSeek: (t: number) => void }).fastSeek(details.seekTime);
        } else {
          el.currentTime = details.seekTime;
        }
      }
    });

    const updatePlaybackState = () => {
      navigator.mediaSession.playbackState = el.paused ? "paused" : "playing";
    };
    el.addEventListener("play", updatePlaybackState);
    el.addEventListener("pause", updatePlaybackState);
    el.addEventListener("ended", updatePlaybackState);

    return () => {
      el.removeEventListener("play", updatePlaybackState);
      el.removeEventListener("pause", updatePlaybackState);
      el.removeEventListener("ended", updatePlaybackState);
      // Clear handlers so the next page's audio sets its own
      ["play", "pause", "seekbackward", "seekforward", "seekto"].forEach((a) => {
        try {
          navigator.mediaSession.setActionHandler(a as MediaSessionAction, null);
        } catch {
          /* ignore */
        }
      });
    };
  }, [src, title, subtitle, artworkSrc]);

  return (
    <audio
      ref={audioRef}
      controls
      preload="metadata"
      src={src}
      onPlay={() => onPlayed?.()}
    />
  );
}
