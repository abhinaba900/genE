"use client";

import { memo, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "blocked" | "error";

interface VideoPlayerProps {
  src: string;
  mimeType?: string;
  captions?: string;
  /** Whether this video is the one on screen. Only the active video ever plays. */
  active: boolean;
  /** Pause request (user tap, hidden tab, menu open…). */
  paused: boolean;
  muted: boolean;
  /** 0–1. Ignored by browsers that don't allow scripted volume (iOS). */
  volume: number;
  preload: "auto" | "metadata" | "none";
  /** Element whose `transform: scaleX()` is driven by playback progress. */
  progressRef?: React.RefObject<HTMLDivElement | null>;
  onStatusChange?: (status: PlayerStatus) => void;
  /** Called when the browser refuses unmuted playback; parent should fall back to muted. */
  onUnmuteRejected?: () => void;
  /** Fired once per mount when playback reaches 95% (the reel loops, so `ended` never fires). */
  onComplete?: () => void;
  /** Letterbox instead of crop — for videos that aren't vertical. */
  fit?: "cover" | "contain";
  label: string;
  className?: string;
}

/**
 * Thin wrapper around <video> tuned for the reel feed:
 * plays only when active, resets when it leaves the viewport, drives the
 * progress bar without React re-renders, and reports loading / error states.
 */
export const VideoPlayer = memo(function VideoPlayer({
  src,
  mimeType,
  captions,
  active,
  paused,
  muted,
  volume,
  preload,
  progressRef,
  onStatusChange,
  onUnmuteRejected,
  onComplete,
  fit = "cover",
  label,
  className,
}: VideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const report = useRef(onStatusChange);
  report.current = onStatusChange;
  const rejectUnmute = useRef(onUnmuteRejected);
  rejectUnmute.current = onUnmuteRejected;
  const complete = useRef(onComplete);
  complete.current = onComplete;
  const completed = useRef(false);

  // Keep the DOM `muted` property in sync (React does not reliably update the attribute).
  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [volume]);

  // Play / pause orchestration.
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (!active) {
      video.pause();
      if (video.currentTime > 0) video.currentTime = 0;
      if (progressRef?.current) progressRef.current.style.transform = "scaleX(0)";
      return;
    }
    if (paused) {
      video.pause();
      report.current?.("paused");
      return;
    }
    let cancelled = false;
    const attempt = video.play();
    attempt?.catch((err: DOMException) => {
      if (cancelled || err.name === "AbortError") return;
      if (err.name === "NotAllowedError" && !video.muted) {
        // Autoplay with sound refused — retry muted and tell the parent.
        video.muted = true;
        rejectUnmute.current?.();
        video.play().catch(() => !cancelled && report.current?.("blocked"));
        return;
      }
      report.current?.(err.name === "NotAllowedError" ? "blocked" : "error");
    });
    return () => {
      cancelled = true;
    };
  }, [active, paused, progressRef]);

  // Progress bar — written directly to the DOM on animation frames.
  useEffect(() => {
    const video = ref.current;
    const bar = progressRef?.current;
    if (!video || !bar || !active) return;
    let raf = 0;
    const tick = () => {
      if (video.duration) bar.style.transform = `scaleX(${video.currentTime / video.duration})`;
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    };
    const stop = () => cancelAnimationFrame(raf);
    video.addEventListener("playing", start);
    video.addEventListener("pause", stop);
    if (!video.paused) start();
    return () => {
      stop();
      video.removeEventListener("playing", start);
      video.removeEventListener("pause", stop);
    };
  }, [active, progressRef]);

  return (
    <video
      ref={ref}
      src={src}
      data-type={mimeType}
      className={cn(
        "absolute inset-0 size-full transition-opacity duration-500",
        fit === "contain" ? "object-contain" : "object-cover",
        ready ? "opacity-100" : "opacity-0",
        className,
      )}
      aria-label={label}
      playsInline
      muted
      loop
      preload={preload}
      disablePictureInPicture
      disableRemotePlayback
      controlsList="nodownload noplaybackrate"
      onLoadedData={() => setReady(true)}
      onWaiting={() => active && report.current?.("loading")}
      onPlaying={() => {
        setReady(true);
        report.current?.("playing");
      }}
      onError={() => report.current?.("error")}
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        if (!completed.current && active && v.duration && v.currentTime / v.duration >= 0.95) {
          completed.current = true;
          complete.current?.();
        }
      }}
      tabIndex={-1}
    >

      {captions && <track kind="captions" src={captions} srcLang="en" label="English" default />}
    </video>
  );
});
