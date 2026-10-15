"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { clampVolume } from "@/lib/volume";

const STEP = 0.05;

/**
 * Accessible custom volume slider (pointer drag, tap, and keyboard).
 * Used vertically on the reel rail and horizontally in the article player.
 */
export function VolumeSlider({
  value,
  onChange,
  orientation = "horizontal",
  onDraggingChange,
  className,
}: {
  /** 0–1, already reflecting mute (muted → 0). */
  value: number;
  onChange: (volume: number) => void;
  orientation?: "horizontal" | "vertical";
  onDraggingChange?: (dragging: boolean) => void;
  className?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const vertical = orientation === "vertical";
  const percent = Math.round(value * 100);

  const setDrag = (d: boolean) => {
    setDragging(d);
    onDraggingChange?.(d);
  };

  const fromPointer = (e: React.PointerEvent) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect) return;
    onChange(
      clampVolume(vertical ? 1 - (e.clientY - rect.top) / rect.height : (e.clientX - rect.left) / rect.width),
    );
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys: Record<string, number> = {
      ArrowUp: value + STEP,
      ArrowRight: value + STEP,
      ArrowDown: value - STEP,
      ArrowLeft: value - STEP,
      PageUp: value + 0.2,
      PageDown: value - 0.2,
      Home: 0,
      End: 1,
    };
    if (!(e.key in keys)) return;
    // Keep surrounding shortcuts (e.g. reel navigation) from also handling these keys.
    e.preventDefault();
    e.stopPropagation();
    onChange(clampVolume(keys[e.key]));
  };

  return (
    <div
      ref={track}
      role="slider"
      tabIndex={0}
      aria-label="Volume"
      aria-orientation={orientation}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={value === 0 ? "Muted" : `${percent}%`}
      onKeyDown={onKeyDown}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDrag(true);
        fromPointer(e);
      }}
      onPointerMove={(e) => dragging && fromPointer(e)}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        setDrag(false);
      }}
      onPointerCancel={() => setDrag(false)}
      // Generous invisible hit area around a slim visual track; no page scroll while dragging.
      className={cn(
        "relative flex shrink-0 cursor-pointer touch-none rounded-full",
        vertical ? "h-32 w-8 justify-center" : "h-8 w-full items-center",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn("absolute overflow-hidden rounded-full bg-white/25", vertical ? "inset-y-0 w-1.5" : "inset-x-0 h-1")}
      >
        <span
          className={cn("absolute rounded-full bg-white", vertical ? "inset-x-0 bottom-0" : "inset-y-0 left-0")}
          style={vertical ? { height: `${percent}%` } : { width: `${percent}%` }}
        />
      </span>
      <span
        aria-hidden
        className={cn(
          "absolute rounded-full bg-white shadow-[0_2px_8px_rgb(0_0_0/0.35)] transition-transform",
          vertical ? "left-1/2 size-4 -translate-x-1/2 translate-y-1/2" : "top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2",
          dragging && "scale-125",
        )}
        style={vertical ? { bottom: `${percent}%` } : { left: `${percent}%` }}
      />
    </div>
  );
}
