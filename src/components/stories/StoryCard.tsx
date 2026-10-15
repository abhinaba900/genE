import { Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/cn";
import type { StorySummary } from "@/lib/content/types";
import { formatDuration, formatShortDate } from "@/lib/format";
import { storyPath } from "@/lib/site";
import { HoverVideo } from "./HoverVideo";

type CardVariant = "reel" | "panel" | "wide" | "compact";

interface StoryCardProps {
  story: StorySummary;
  variant?: CardVariant;
  /** Heading level for the card title, to keep the page outline logical. */
  as?: "h2" | "h3" | "h4";
  priority?: boolean;
  className?: string;
}

/**
 * Story card family:
 * - reel:    vertical 9:16 video thumbnail with hover preview
 * - panel:   image over a soft category-tinted panel (magazine grid)
 * - wide:    horizontal feature — image left, tinted panel right
 * - compact: small list row for sidebars and search
 */
export function StoryCard({ story, variant = "reel", as: Heading = "h3", priority, className }: StoryCardProps) {
  const href = storyPath(story.slug);

  if (variant === "compact") {
    return (
      <article className={cn("group relative flex gap-4", className)}>
        <div className="relative aspect-[4/5] w-[76px] shrink-0 overflow-hidden rounded-lg bg-paper-2">
          <Image src={story.video.poster} alt="" fill sizes="96px" className="object-cover" />
          <span className="absolute bottom-1.5 left-1.5 flex size-5 items-center justify-center rounded-full bg-black/45 text-white">
            <Play className="ml-px size-2.5 fill-current" aria-hidden />
          </span>
        </div>
        <div className="min-w-0 py-0.5">
          <Meta story={story} />
          <Heading className="mt-1.5 font-serif text-[18px] leading-[1.18] tracking-[-0.01em] text-ink [text-wrap:pretty]">
            <Link href={href} className="after:absolute after:inset-0 group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
              {story.title}
            </Link>
          </Heading>
        </div>
      </article>
    );
  }

  if (variant === "wide") {
    return (
      <article
        data-hover-card
        className={cn("group relative grid overflow-hidden rounded-2xl md:grid-cols-[1.15fr_1fr]", className)}
        style={{ backgroundColor: story.category.tint }}
      >
        <div className="relative aspect-[4/3] overflow-hidden md:aspect-auto md:min-h-[380px]">
          <Image
            src={story.thumbnail.src}
            alt={story.thumbnail.alt}
            fill
            priority={priority}
            sizes="(min-width: 768px) 55vw, 100vw"
            className="object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.03]"
          />
          <HoverVideo src={story.video.src} />
        </div>
        <div className="flex flex-col justify-center p-7 md:p-12">
          <Meta story={story} />
          <Heading className="mt-4 font-serif text-[30px] leading-[1.08] tracking-[-0.02em] text-ink md:text-[40px] [text-wrap:balance]">
            <Link href={href} className="after:absolute after:inset-0">
              {story.title}
            </Link>
          </Heading>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink/70">{story.excerpt}</p>
          <p className="mt-6 text-[13px] text-ink/55">
            By {story.author.name} · {story.readingTime} min read
          </p>
        </div>
      </article>
    );
  }

  if (variant === "panel") {
    return (
      <article data-hover-card className={cn("group relative flex flex-col overflow-hidden rounded-2xl", className)}>
        <div className="relative aspect-[4/3] overflow-hidden bg-paper-2">
          <Image
            src={story.thumbnail.src}
            alt={story.thumbnail.alt}
            fill
            priority={priority}
            sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
            className="object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.04]"
          />
          <HoverVideo src={story.video.src} />
          <Duration seconds={story.video.duration} />
        </div>
        <div className="flex flex-1 flex-col p-5 pb-6" style={{ backgroundColor: story.category.tint }}>
          <Meta story={story} />
          <Heading className="mt-3 font-serif text-[22px] leading-[1.15] tracking-[-0.01em] text-ink [text-wrap:balance]">
            <Link href={href} className="after:absolute after:inset-0">
              {story.title}
            </Link>
          </Heading>
          <p className="mt-2 line-clamp-2 text-[14px] leading-relaxed text-ink/65">{story.excerpt}</p>
        </div>
      </article>
    );
  }

  // reel
  return (
    <article data-hover-card className={cn("group relative", className)}>
      <div className="relative aspect-[9/16] overflow-hidden rounded-2xl bg-ink">
        <Image
          src={story.video.poster}
          alt={story.thumbnail.alt}
          fill
          priority={priority}
          sizes="(min-width: 1280px) 260px, (min-width: 768px) 22vw, 45vw"
          className="object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.04]"
        />
        <HoverVideo src={story.video.src} />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
        <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium text-white">
          <Play className="size-2.5 fill-current" aria-hidden />
          <span className="sr-only">Video, </span>
          {formatDuration(story.video.duration)}
        </span>
        <p className="kicker absolute bottom-4 left-4 right-4 text-white/85">{story.category.name}</p>
      </div>
      <Heading className="mt-4 font-serif text-[20px] leading-[1.15] tracking-[-0.01em] text-ink [text-wrap:balance]">
        <Link href={href} className="after:absolute after:inset-0 group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
          {story.title}
        </Link>
      </Heading>
      <p className="mt-2 text-[13px] text-muted">
        <time dateTime={story.publishedAt}>{formatShortDate(story.publishedAt)}</time> · {story.readingTime} min read
      </p>
    </article>
  );
}

function Meta({ story }: { story: StorySummary }) {
  return (
    <p className="kicker flex items-center gap-2 text-ink/60">
      <span>{story.category.name}</span>
      <span aria-hidden className="size-[3px] rounded-full bg-ink/30" />
      <time dateTime={story.publishedAt} className="normal-case tracking-normal">
        {formatShortDate(story.publishedAt)}
      </time>
    </p>
  );
}

function Duration({ seconds }: { seconds: number }) {
  return (
    <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white">
      <Play className="size-2.5 fill-current" aria-hidden />
      <span className="sr-only">Video, </span>
      {formatDuration(seconds)}
    </span>
  );
}
