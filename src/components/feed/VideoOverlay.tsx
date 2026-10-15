import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ShareButton } from "@/components/ui/ShareButton";
import { cn } from "@/lib/cn";
import { storyPath } from "@/lib/site";
import { VolumeControl } from "./VolumeControl";
import type { FeedStory } from "./types";

/**
 * Text + actions layered over a reel: category, headline, intro,
 * "Read full story", share and mute. Gradients keep it legible on any frame.
 */
export function VideoOverlay({
  story,
  index,
  total,
  muted,
  volume,
  onToggleMute,
  onVolumeChange,
  headingId,
  compact = false,
}: {
  story: FeedStory;
  index: number;
  total: number;
  muted: boolean;
  volume: number;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  headingId: string;
  /**
   * While a film plays the overlay shrinks (intro hidden, headline ≤ 2 lines)
   * so the film's own burned-in subtitles above it stay readable.
   */
  compact?: boolean;
}) {
  const href = storyPath(story.slug);
  return (
    <>
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent transition-[height] duration-500 ease-out-soft",
          compact ? "h-[34%]" : "h-[62%]",
        )}
      />
      <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 pb-[calc(env(safe-area-inset-bottom)+30px)] pl-5 pr-3">
        <div className="min-w-0 flex-1 pb-1">
          <p className="kicker flex items-center gap-2 text-white/80">
            <span aria-hidden className="size-1.5 rounded-full bg-accent" />
            {story.category.name}
            {story.isDemo && (
              <span className="ml-1 rounded-full px-2 py-0.5 text-[9px] tracking-[0.16em] text-white/70 ring-1 ring-white/25">
                Demo story
              </span>
            )}
          </p>
          <h2
            id={headingId}
            className={cn(
              "mt-3 font-serif text-[clamp(1.6rem,6.8vw,2.2rem)] leading-[1.06] tracking-[-0.015em] text-white [text-wrap:balance]",
              compact ? "line-clamp-2" : "line-clamp-4",
            )}
          >
            {story.title}
          </h2>
          <div
            className={cn(
              "grid transition-[grid-template-rows,opacity] duration-500 ease-out-soft",
              compact ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
            )}
          >
            <p className="overflow-hidden">
              <span className="mt-3 line-clamp-2 max-w-[34ch] text-[14.5px] leading-snug text-white/75">
                {story.excerpt}
              </span>
            </p>
          </div>
          <div className={cn("flex items-center gap-4 transition-[margin] duration-500", compact ? "mt-4" : "mt-5")}>
            <Link
              href={href}
              onClick={(e) => e.stopPropagation()}
              className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-white pl-5 pr-4 text-[15px] font-semibold text-ink shadow-[0_8px_30px_rgb(0_0_0/0.25)] transition-transform duration-200 active:scale-[0.97]"
            >
              Read full story
              <ArrowRight
                className="size-[18px] transition-transform duration-300 group-hover:translate-x-0.5"
                strokeWidth={2}
                aria-hidden
              />
            </Link>
            <span className="text-[12px] text-white/60">{story.readingTime} min read</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-center gap-5 pb-1">
          <VolumeControl muted={muted} volume={volume} onToggleMute={onToggleMute} onVolumeChange={onVolumeChange} />
          <ShareButton variant="overlay" path={href} title={story.title} text={story.excerpt} />
          <span aria-hidden className="text-[11px] tabular-nums tracking-wide text-white/55">
            {String(index + 1).padStart(2, "0")}/{String(total).padStart(2, "0")}
          </span>
        </div>
      </div>
    </>
  );
}
