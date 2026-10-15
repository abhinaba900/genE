"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

const HOVER_DELAY = 220;

/**
 * Muted video preview that plays only while its card is hovered (fine pointers only).
 * The <video> isn't created until the first hover, so grids never download dozens of clips.
 */
export function HoverVideo({ src, className }: { src: string; className?: string }) {
  const host = useRef<HTMLSpanElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const wantPlay = useRef(false);
  const [armed, setArmed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const card = host.current?.closest<HTMLElement>("[data-hover-card]");
    if (!card) return;
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!canHover || calm) return;

    let timer: ReturnType<typeof setTimeout>;
    const enter = () => {
      timer = setTimeout(() => {
        wantPlay.current = true;
        setArmed(true);
        const v = video.current;
        if (v) v.play().then(() => wantPlay.current && setVisible(true)).catch(() => {});
      }, HOVER_DELAY);
    };
    const leave = () => {
      clearTimeout(timer);
      wantPlay.current = false;
      setVisible(false);
      const v = video.current;
      if (v) {
        v.pause();
        v.currentTime = 0;
      }
    };
    card.addEventListener("pointerenter", enter);
    card.addEventListener("pointerleave", leave);
    return () => {
      clearTimeout(timer);
      card.removeEventListener("pointerenter", enter);
      card.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <span ref={host} aria-hidden className="contents">
      {armed && (
        <video
          ref={(el) => {
            video.current = el;
            // First hover: start as soon as the element exists.
            if (el && wantPlay.current && el.paused) el.play().then(() => wantPlay.current && setVisible(true)).catch(() => {});
          }}
          src={src}
          muted
          loop
          playsInline
          preload="auto"
          tabIndex={-1}
          className={cn(
            "pointer-events-none absolute inset-0 size-full object-cover transition-opacity duration-500",
            visible ? "opacity-100" : "opacity-0",
            className,
          )}
        />
      )}
    </span>
  );
}
