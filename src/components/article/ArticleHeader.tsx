import Link from "next/link";
import { ShareButton } from "@/components/ui/ShareButton";
import type { Story } from "@/lib/content/types";
import { formatDate } from "@/lib/format";
import { categoryPath, storyPath } from "@/lib/site";
import { ArticleMedia } from "./ArticleMedia";

/** Editorial article opener: kicker, headline, standfirst, byline and the story's film. */
export function ArticleHeader({ story }: { story: Story }) {
  const initials = story.author.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <header className="mx-auto grid max-w-[1680px] items-center gap-10 px-5 pt-8 md:px-8 md:pt-14 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12 xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-20 xl:px-12">
      <div>
        <p className="enter kicker flex flex-wrap items-center gap-2.5 text-ink/60">
          <span aria-hidden className="size-1.5 rounded-full bg-accent" />
          <Link href={categoryPath(story.category.slug)} className="hover:text-ink">
            {story.category.name}
          </Link>
          {story.isDemo && (
            <span className="rounded-full px-2 py-0.5 text-[9px] tracking-[0.16em] text-ink/55 ring-1 ring-ink/20">
              Demo story
            </span>
          )}
        </p>
        <h1 id="article-title" className="enter mt-5 font-serif text-[clamp(2.4rem,1.5rem+4vw,4.6rem)] font-normal leading-[1.02] tracking-[-0.025em] text-ink [text-wrap:balance] [--step:1]">
          {story.title}
        </h1>
        <p className="enter mt-6 max-w-[56ch] font-serif text-[21px] leading-[1.45] text-ink/70 md:text-[23px] [--step:2]">
          {story.excerpt}
        </p>

        <div className="enter mt-8 flex flex-wrap items-center justify-between gap-5 border-y border-line py-5 [--step:3]">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex size-11 items-center justify-center rounded-full font-serif text-[15px] text-ink"
              style={{ backgroundColor: story.category.tint }}
            >
              {initials}
            </span>
            <div className="text-[14px] leading-snug">
              <p className="font-medium text-ink">
                By {story.author.name}
              </p>
              <p className="text-muted">
                <time dateTime={story.publishedAt}>{formatDate(story.publishedAt)}</time> · {story.readingTime} min read
              </p>
            </div>
          </div>
          <ShareButton variant="ghost" path={storyPath(story.slug)} title={story.title} text={story.excerpt} label="Share story" />
        </div>
      </div>

      {/* Film wipes up on first paint (no settle scale: it may already be playing). */}
      <div className="enter-media -mx-5 [--step:1] sm:mx-auto sm:w-[400px] sm:[--wipe-radius:22px] lg:w-full">
        <ArticleMedia
          video={story.video}
          title={story.title}
          autoPlay
          className="mx-auto aspect-[9/16] max-h-[82svh] w-full sm:rounded-[22px]"
        />
      </div>
    </header>
  );
}
