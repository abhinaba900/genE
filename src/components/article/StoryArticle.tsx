import { ArrowLeft, ArrowUpRight, Play } from "lucide-react";
import Link from "next/link";
import { ArticleBody } from "@/components/article/ArticleBody";
import { ArticleHeader } from "@/components/article/ArticleHeader";
import { ReadingProgress } from "@/components/article/ReadingProgress";
import { RelatedStories } from "@/components/article/RelatedStories";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { JsonLd, articleJsonLd } from "@/components/seo/JsonLd";
import { ShareButton } from "@/components/ui/ShareButton";
import { TrackView } from "@/components/ui/TrackView";
import type { Story, StorySummary } from "@/lib/content/types";
import { storyPath, watchPath } from "@/lib/site";

/** The article layout — shared by the public page and the CMS preview. */
export function StoryArticle({ story, related, preview = false }: { story: Story; related: StorySummary[]; preview?: boolean }) {

  return (
    <>
      {!preview && <JsonLd data={articleJsonLd(story)} />}
      {!preview && <TrackView storyId={story.id} />}
      <ReadingProgress targetId="article" />
      <SiteHeader />
      <main id="main">
        <nav aria-label="Back" className="mx-auto max-w-[1680px] px-5 pt-4 md:px-8 xl:px-12">
          {/* Mobile returns to the reel on this exact story; desktop offers the framed reel. */}
          <Link
            href={`/?story=${encodeURIComponent(story.slug)}`}
            className="group inline-flex min-h-11 items-center gap-2 text-[14px] font-medium text-ink/70 hover:text-ink md:hidden"
          >
            <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" aria-hidden />
            Back to the feed
          </Link>
          <Link
            href={watchPath(story.slug)}
            className="group hidden min-h-11 items-center gap-2 text-[14px] font-medium text-ink/70 hover:text-ink md:inline-flex"
          >
            <Play className="size-3.5 fill-current" aria-hidden />
            Watch in the reel
          </Link>
        </nav>

        <article id="article" aria-labelledby="article-title">
          <ArticleHeader story={story} />

          <div className="mt-14 md:mt-20">
            <ArticleBody blocks={story.body} title={story.title} />
          </div>

          <footer className="mx-auto mt-16 max-w-[680px] px-5 md:px-0">
            {story.isDemo && (
              <p className="rounded-xl bg-paper-2 px-5 py-4 text-[13px] leading-relaxed text-muted">
                <strong className="font-semibold text-ink">Demonstration content.</strong> This story, its people, places
                and quotes are fictional and exist only to show how gen.E presents journalism.
              </p>
            )}
            {story.sourceUrl && (
              <p className="text-[14px] text-muted">
                This film was originally published on{" "}
                <a
                  href={story.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
                >
                  gen.E’s YouTube channel
                  <ArrowUpRight className="size-3.5" aria-hidden />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
                .
              </p>
            )}

            <div className="mt-10 flex flex-wrap items-center justify-between gap-6 border-t border-line pt-8">
              <ul aria-label="Tags" className="flex flex-wrap gap-2">
                {story.tags.map((tag) => (
                  <li key={tag}>
                    <Link
                      href={`/search?q=${encodeURIComponent(tag)}`}
                      className="inline-flex min-h-9 items-center rounded-full px-3.5 text-[13px] text-ink/75 ring-1 ring-ink/12 transition-colors hover:bg-ink hover:text-white"
                    >
                      #{tag}
                    </Link>
                  </li>
                ))}
              </ul>
              <ShareButton path={storyPath(story.slug)} title={story.title} text={story.excerpt} label="Share this story" />
            </div>

            <section aria-label="About the author" className="mt-10 flex gap-4 rounded-2xl p-6" style={{ backgroundColor: story.category.tint }}>
              <div>
                <p className="kicker text-ink/65">Written by</p>
                <p className="mt-2 font-serif text-[22px] text-ink">{story.author.name}</p>
                <p className="text-[14px] text-ink/70">{story.author.role}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-ink/65">{story.author.bio}</p>
              </div>
            </section>
          </footer>
        </article>

        <RelatedStories stories={related} />
      </main>
      <SiteFooter />
    </>
  );
}
