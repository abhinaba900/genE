import { Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { StorySummary } from "@/lib/content/types";
import { formatDate, formatDuration } from "@/lib/format";
import { storyPath } from "@/lib/site";
import { Highlight } from "@/components/ui/Highlight";

/** Full-width list row used by Latest and Search results. */
export function StoryRow({
  story,
  as: Heading = "h2",
  highlight,
  href,
}: {
  story: StorySummary;
  as?: "h2" | "h3";
  /** Optional search query to emphasise in the title and excerpt. */
  highlight?: string;
  /** Override the destination (e.g. open the reel instead of the article). Defaults to the article. */
  href?: string;
}) {
  return (
    <article data-hover-card className="group relative grid grid-cols-[96px_minmax(0,1fr)] gap-5 border-b border-line py-7 transition-transform duration-200 ease-out-soft active:scale-[0.99] sm:grid-cols-[132px_minmax(0,1fr)] md:gap-8">
      <div className="relative aspect-[9/16] overflow-hidden rounded-xl bg-ink">
        <Image
          src={story.video.poster}
          alt=""
          fill
          sizes="(min-width: 640px) 132px, 96px"
          className="object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.05] group-focus-within:scale-[1.05]"
        />
        <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white">
          <Play className="size-2 fill-current" aria-hidden />
          <span className="sr-only">Video, </span>
          {formatDuration(story.video.duration)}
        </span>
      </div>
      <div className="flex min-w-0 flex-col justify-center">
        <p className="kicker flex flex-wrap items-center gap-2 text-ink/55">
          <span className="inline-flex rounded-full px-2.5 py-1 text-ink" style={{ backgroundColor: story.category.tint }}>
            {story.category.name}
          </span>
          <time dateTime={story.publishedAt} className="normal-case tracking-normal">
            {formatDate(story.publishedAt)}
          </time>
        </p>
        <Heading className="mt-3 font-serif text-[22px] leading-[1.14] tracking-[-0.015em] text-ink sm:text-[28px] [text-wrap:balance]">
          <Link href={href ?? storyPath(story.slug)} className="after:absolute after:inset-0 decoration-1 underline-offset-[6px] group-hover:underline group-focus-within:underline">
            <Highlight text={story.title} query={highlight} />
          </Link>
        </Heading>
        <p className="mt-2 line-clamp-3 max-w-[62ch] text-[15px] leading-relaxed text-ink/65 max-sm:line-clamp-2">
          <Highlight text={story.excerpt} query={highlight} />
        </p>
        <p className="mt-3 text-[13px] text-muted">
          By {story.author.name} · {story.readingTime} min read
        </p>
      </div>
    </article>
  );
}
