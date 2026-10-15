"use client";

import { Volume1, Volume2, VolumeX } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { VolumeSlider } from "@/components/ui/VolumeSlider";
import { cn } from "@/lib/cn";
import { useVolumeSupported } from "@/lib/volume";

const HIDE_AFTER_MS = 2600;

/** Reel rail sound control: tap to mute/unmute, plus a vertical volume slider. */
export function VolumeControl({
  muted,
  volume,
  onToggleMute,
  onVolumeChange,
}: {
  muted: boolean;
  volume: number;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
}) {
  const supported = useVolumeSupported();
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const hovering = useRef(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const level = muted ? 0 : volume;
  const Icon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;

  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!hovering.current) setOpen(false);
    }, HIDE_AFTER_MS);
  }, []);

  const reveal = useCallback(() => {
    if (!supported) return;
    setOpen(true);
    scheduleHide();
  }, [supported, scheduleHide]);

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  const percent = Math.round(level * 100);

  return (
    <div
      className="relative flex flex-col items-center"
      onClick={(e) => e.stopPropagation()}
      onPointerEnter={(e) => {
        if (e.pointerType !== "mouse") return;
        hovering.current = true;
        reveal();
      }}
      onPointerLeave={(e) => {
        if (e.pointerType !== "mouse") return;
        hovering.current = false;
        scheduleHide();
      }}
      onFocus={reveal}
    >
      {supported && (
        <div
          className={cn(
            "absolute bottom-[calc(100%+10px)] left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 rounded-full bg-black/45 px-3 pb-3 pt-3.5 ring-1 ring-white/15 transition-all duration-300 ease-out-soft",
            open || dragging ? "visible translate-y-0 opacity-100" : "invisible translate-y-2 opacity-0",
          )}
        >
          <span aria-hidden className="text-[10px] font-medium tabular-nums text-white/80">
            {percent}
          </span>
          <VolumeSlider
            orientation="vertical"
            value={level}
            onChange={(v) => {
              onVolumeChange(v);
              reveal();
            }}
            onDraggingChange={(d) => {
              setDragging(d);
              if (!d) scheduleHide();
            }}
          />
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          onToggleMute();
          // Opening the slider on unmute makes the volume level discoverable.
          if (muted) reveal();
          else setOpen(false);
        }}
        aria-pressed={!muted}
        aria-label={muted ? "Unmute video" : "Mute video"}
        className="group flex flex-col items-center gap-1.5 text-white"
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-black/25 ring-1 ring-white/15 transition-transform duration-200 group-active:scale-90">
          <Icon className="size-[21px]" strokeWidth={1.6} />
        </span>
        <span aria-hidden className="text-[11px] font-medium tracking-wide text-white/85">
          {muted ? "Sound off" : "Sound on"}
        </span>
      </button>
    </div>
  );
}
