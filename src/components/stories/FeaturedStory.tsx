import { ArrowRight, Play } from "lucide-react";
import Link from "next/link";
import type { StorySummary } from "@/lib/content/types";
import { formatDate } from "@/lib/format";
import { storyPath, watchPath } from "@/lib/site";
import { FeaturedVideo } from "./FeaturedVideo";

/** Desktop homepage lead: a large editorial headline paired with the story's vertical film. */
export function FeaturedStory({ story }: { story: StorySummary }) {
  return (
    <section aria-labelledby="featured-title" className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_auto] lg:gap-16 xl:gap-20">
      <div className="max-w-[640px] animate-rise 2xl:max-w-[780px]">
        <p className="kicker flex items-center gap-2.5 text-ink/60">
          <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          Featured · {story.category.name}
        </p>
        <h1
          id="featured-title"
          className="mt-5 font-serif text-[clamp(2.25rem,0.9rem+3.8vw,5rem)] font-normal leading-[1.02] tracking-[-0.025em] text-ink [text-wrap:balance] lg:mt-6"
        >
          <Link href={storyPath(story.slug)} className="transition-colors hover:text-ink-2">
            {story.title}
          </Link>
        </h1>
        <p className="mt-5 max-w-[52ch] text-[16px] leading-relaxed text-ink/70 lg:mt-6 lg:text-[18px]">{story.excerpt}</p>
        <p className="mt-6 text-[14px] text-muted">
          By <span className="text-ink">{story.author.name}</span> ·{" "}
          <time dateTime={story.publishedAt}>{formatDate(story.publishedAt)}</time> · {story.readingTime} min read
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3 lg:mt-9">
          <Link
            href={storyPath(story.slug)}
            className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-ink pl-6 pr-5 text-[15px] font-medium text-white transition-colors hover:bg-ink-2"
          >
            Read the full story
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
          <Link
            href={watchPath(story.slug)}
            className="inline-flex h-12 items-center gap-2.5 rounded-full px-5 text-[15px] font-medium text-ink ring-1 ring-ink/15 transition-colors hover:bg-ink/5"
          >
            <Play className="size-3.5 fill-current" aria-hidden />
            Watch in the reel
          </Link>
        </div>
      </div>
      <div className="mx-auto h-[min(58vh,500px)] min-h-[360px] animate-fade-in lg:h-[min(72vh,680px)] lg:min-h-[440px]">
        <FeaturedVideo src={story.video.src} poster={story.video.poster} title={story.title} />
      </div>
    </section>
  );
}
