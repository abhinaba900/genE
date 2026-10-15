"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";

/** Thin playback progress line. Width is driven imperatively via `barRef`. */
export function ProgressLine({
  barRef,
  className,
}: {
  barRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  return (
    <div aria-hidden className={cn("h-[2px] w-full overflow-hidden bg-white/20", className)}>
      <div ref={barRef} className="h-full w-full origin-left scale-x-0 bg-white will-change-transform" />
    </div>
  );
}

/** Large centred state indicator: paused / blocked / tap feedback. */
export function CenterIndicator({
  state,
  flashKey,
}: {
  state: "paused" | "needs-play" | null;
  /** Changing this replays the brief tap-feedback animation. */
  flashKey: number;
}) {
  return (
    <>
      {state && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex size-[72px] animate-fade-in items-center justify-center rounded-full bg-black/35 text-white ring-1 ring-white/20">
            <Play className="ml-1 size-8 fill-current" strokeWidth={1.4} aria-hidden />
          </span>
          {state === "needs-play" && <span className="sr-only">Tap to play video</span>}
        </div>
      )}
      {flashKey > 0 && !state && (
        <div key={flashKey} className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex size-[72px] items-center justify-center rounded-full bg-black/35 text-white [animation:flash_0.6s_ease-out_forwards]">
            <Pause className="size-8 fill-current" strokeWidth={1.4} aria-hidden />
          </span>
        </div>
      )}
    </>
  );
}

export function LoadingIndicator() {
  return (
    <div role="status" className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <span
        aria-hidden
        className="size-10 rounded-full border-2 border-white/20 border-t-white/90 opacity-0 [animation:spin_0.9s_linear_infinite,fade-in-plain_0.3s_0.35s_forwards]"
      />
      <span className="sr-only">Loading video</span>
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/50 px-10 text-center text-white">
      <p className="font-serif text-2xl">This video didn’t load.</p>
      <p className="max-w-xs text-sm text-white/70">Check your connection, or read the full story below.</p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRetry();
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/15 px-5 text-sm font-medium ring-1 ring-white/25 hover:bg-white/25"
      >
        <RotateCcw className="size-4" aria-hidden />
        Try again
      </button>
    </div>
  );
}
