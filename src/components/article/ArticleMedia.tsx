"use client";

import { Maximize, Pause, Play, Volume1, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { VolumeSlider } from "@/components/ui/VolumeSlider";
import { cn } from "@/lib/cn";
import { DEFAULT_VOLUME, readStoredVolume, storeVolume, useVolumeSupported } from "@/lib/volume";
import { formatDuration } from "@/lib/format";
import type { StoryVideo } from "@/lib/content/types";

const HIDE_VOLUME_AFTER_MS = 2600;

/**
 * Article video with accessible custom controls.
 * Server-rendered with native `controls` so it works without JavaScript;
 * swaps to the custom UI once hydrated.
 */
export function ArticleMedia({
  video,
  title,
  className,
  autoPlay = false,
}: {
  video: StoryVideo;
  title: string;
  className?: string;
  autoPlay?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const [hydrated, setHydrated] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(video.duration);
  const [started, setStarted] = useState(false);
  const [error, setError] = useState(false);
  const seekId = useId();
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const volumeSupported = useVolumeSupported();
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [draggingVolume, setDraggingVolume] = useState(false);
  const hoveringVolume = useRef(false);
  const hideVolumeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setHydrated(true);
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    const saved = readStoredVolume();
    if (saved) setVolume(saved);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (autoPlay && !calm) v.play().catch(() => {});
  }, [autoPlay]);

  // Pause when the tab is hidden.
  useEffect(() => {
    const onVis = () => document.visibilityState === "hidden" && ref.current?.pause();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const toggle = useCallback(() => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => setError(true));
    } else v.pause();
  }, []);

  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [volume]);
  useEffect(() => () => clearTimeout(hideVolumeTimer.current), []);

  const scheduleVolumeHide = useCallback(() => {
    clearTimeout(hideVolumeTimer.current);
    hideVolumeTimer.current = setTimeout(() => {
      if (!hoveringVolume.current) setVolumeOpen(false);
    }, HIDE_VOLUME_AFTER_MS);
  }, []);

  const revealVolume = useCallback(() => {
    if (!volumeSupported) return;
    setVolumeOpen(true);
    scheduleVolumeHide();
  }, [volumeSupported, scheduleVolumeHide]);

  const toggleMute = () => {
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) {
      // Unmuting at zero volume would be silent — restore a sensible level.
      if (volume === 0) setVolume(0.6);
      revealVolume();
    } else setVolumeOpen(false);
  };

  const changeVolume = (next: number) => {
    const v = ref.current;
    setVolume(next);
    setMuted(next === 0);
    if (v) v.muted = next === 0;
    storeVolume(next);
    revealVolume();
  };

  const level = muted ? 0 : volume;
  const VolumeIcon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;
  const showVolume = volumeOpen || draggingVolume;

  const fullscreen = () => {
    const v = ref.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    const host = wrapper.current;
    if (!v || !host) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (host.requestFullscreen) host.requestFullscreen().catch(() => {});
    else v.webkitEnterFullscreen?.(); // iOS Safari
  };

  return (
    <div ref={wrapper} className={cn("group/media relative overflow-hidden bg-ink", className)}>
      <video
        ref={ref}
        src={video.src}
        poster={video.poster}
        controls={!hydrated}
        playsInline
        muted
        loop
        preload="metadata"
        aria-label={`Video: ${title}`}
        className="size-full object-cover"
        onClick={hydrated ? toggle : undefined}
        onPlay={() => {
          setPlaying(true);
          setStarted(true);
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || video.duration)}
        onError={() => setError(true)}
      >
        {video.captions && <track kind="captions" src={video.captions} srcLang="en" label="English" />}
      </video>

      {hydrated && error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-6 text-center text-white">
          <p className="font-serif text-xl">This video is unavailable right now.</p>
        </div>
      )}

      {hydrated && !error && (
        <>
          {!started && (
            <button
              type="button"
              onClick={toggle}
              aria-label="Play video"
              className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors hover:bg-black/20"
            >
              <span className="flex size-[72px] items-center justify-center rounded-full bg-white/90 text-ink shadow-xl transition-transform duration-300 group-hover/media:scale-105">
                <Play className="ml-1 size-7 fill-current" aria-hidden />
              </span>
            </button>
          )}
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 pb-3 pt-10 text-white transition-opacity duration-300",
              started ? "opacity-100" : "pointer-events-none opacity-0",
              playing && "md:opacity-0 md:group-hover/media:opacity-100 md:group-focus-within/media:opacity-100",
            )}
          >
            <ControlButton label={playing ? "Pause" : "Play"} onClick={toggle}>
              {playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
            </ControlButton>
            <label className="sr-only" htmlFor={seekId}>
              Seek
            </label>
            <input
              id={seekId}
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={time}
              onChange={(e) => {
                const v = ref.current;
                if (v) v.currentTime = Number(e.target.value);
              }}
              aria-valuetext={`${formatDuration(time)} of ${formatDuration(duration)}`}
              className="h-1 min-w-0 flex-1 cursor-pointer accent-white"
            />
            <span
              aria-hidden
              className={cn(
                "w-[74px] shrink-0 text-center text-[11px] tabular-nums text-white/80",
                // Give the volume slider room while it's open; the seek bar keeps its width.
                showVolume && "hidden",
              )}
            >
              {formatDuration(time)} / {formatDuration(duration)}
            </span>
            <div
              className="flex items-center"
              onPointerEnter={(e) => {
                if (e.pointerType !== "mouse") return;
                hoveringVolume.current = true;
                revealVolume();
              }}
              onPointerLeave={(e) => {
                if (e.pointerType !== "mouse") return;
                hoveringVolume.current = false;
                scheduleVolumeHide();
              }}
              onFocus={revealVolume}
            >
              <ControlButton label={muted ? "Unmute" : "Mute"} onClick={toggleMute} pressed={!muted}>
                <VolumeIcon className="size-4" />
              </ControlButton>
              {volumeSupported && (
                <div
                  className={cn(
                    "overflow-hidden transition-[width,opacity] duration-300 ease-out-soft",
                    showVolume ? "w-[76px] opacity-100" : "w-0 opacity-0",
                  )}
                >
                  <div className="w-[76px] px-2">
                    <VolumeSlider
                      value={level}
                      onChange={changeVolume}
                      onDraggingChange={(d) => {
                        setDraggingVolume(d);
                        if (!d) scheduleVolumeHide();
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            <ControlButton label="Full screen" onClick={fullscreen}>
              <Maximize className="size-4" />
            </ControlButton>
          </div>
        </>
      )}
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  pressed,
  children,
}: {
  label: string;
  onClick: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      className="flex size-10 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-white/15"
    >
      {children}
    </button>
  );
}
