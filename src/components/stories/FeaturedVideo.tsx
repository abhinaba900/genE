"use client";

import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Single autoplaying (muted) video for the desktop featured story.
 * Loads nothing on small screens, pauses when scrolled out of view or the tab is hidden.
 */
export function FeaturedVideo({ src, poster, title }: { src: string; poster: string; title: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [inView, setInView] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [ready, setReady] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setEnabled(desktop);
    if (calm) setUserPaused(true);
    const el = frame.current;
    if (!el || !desktop) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    const onVis = () => setPageHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (inView && !userPaused && !pageHidden) {
      v.play().catch((err: DOMException) => {
        // AbortError just means a pause() interrupted us; only a policy refusal should stick.
        if (err.name === "NotAllowedError") setUserPaused(true);
      });
    } else v.pause();
  }, [inView, userPaused, pageHidden, enabled]);

  useEffect(() => {
    if (video.current) video.current.muted = muted;
  }, [muted]);

  return (
    <div ref={frame} className="relative aspect-[9/16] h-full overflow-hidden rounded-[22px] bg-ink">
      <Image src={poster} alt="" fill priority sizes="(min-width: 768px) 380px, 100vw" className="enter-settle object-cover [--step:1]" />
      {enabled && (
        <video
          ref={video}
          src={src}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label={`Video: ${title}`}
          onPlaying={() => setReady(true)}
          className={cn("enter-settle absolute inset-0 size-full object-cover transition-opacity duration-700 [--step:1]", ready ? "opacity-100" : "opacity-0")}
        />
      )}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/50 to-transparent" />
      {enabled && (
        <div className="absolute bottom-4 left-4 z-10 flex gap-2">
          <button
            type="button"
            onClick={() => setUserPaused((p) => !p)}
            aria-label={userPaused ? "Play video" : "Pause video"}
            className="flex size-10 items-center justify-center rounded-full bg-black/40 text-white ring-1 ring-white/20 transition duration-200 hover:bg-black/60 active:scale-90"
          >
            {userPaused ? <Play className="ml-0.5 size-4 fill-current" /> : <Pause className="size-4 fill-current" />}
          </button>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? "Unmute video" : "Mute video"}
            aria-pressed={!muted}
            className="flex size-10 items-center justify-center rounded-full bg-black/40 text-white ring-1 ring-white/20 transition duration-200 hover:bg-black/60 active:scale-90"
          >
            {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </button>
        </div>
      )}
    </div>
  );
}
