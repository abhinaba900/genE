import { Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { VideoFeed } from "@/components/feed/VideoFeed";
import { toFeedStory } from "@/components/feed/types";
import { getNavData } from "@/components/layout/getNavData";
import { Sidebar } from "@/components/layout/Sidebar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Reveal } from "@/components/motion/Reveal";
import { StoryCard } from "@/components/stories/StoryCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { findCategoryRedirect, getCategories, getCategory, getFeed, getHighlights, getStories } from "@/lib/content";
import { categoryPath, shareImage, watchPath, SITE_NAME } from "@/lib/site";

type Params = { slug: string };

export const revalidate = 60;

/**
 * Pre-render every category (revalidated like the rest of the site). Swiping between
 * categories prefetches the neighbours; static pages make that prefetch complete, so the
 * next reel is already on the device when the swipe ends — no server round trip.
 * Categories added later still render on first request (`dynamicParams` stays on).
 */
export async function generateStaticParams() {
  return (await getCategories()).map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: "Category not found" };
  return {
    title: category.name,
    description: category.description,
    alternates: { canonical: categoryPath(slug) },
    openGraph: { siteName: SITE_NAME, title: `${category.name} · gen.E`, description: category.description, url: categoryPath(slug), images: [shareImage(category.image)] },
    twitter: { card: "summary_large_image", images: [shareImage(category.image).url] },
  };
}

export default async function CategoryPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) {
    const moved = await findCategoryRedirect(slug);
    if (moved) permanentRedirect(categoryPath(moved));
    notFound();
  }

  const [stories, feed, highlights, categories, nav] = await Promise.all([
    getStories(slug),
    getFeed(slug),
    getHighlights(5),
    getCategories(),
    getNavData(),
  ]);
  const [lead, ...rest] = stories;

  return (
    <>
      <div className="hidden md:contents">
        <SiteHeader />
      </div>
      <main id="main">
        {/* Mobile: the category as a reel */}
        <div className="md:hidden">
          <h1 className="sr-only">{category.name} stories</h1>
          <VideoFeed key={slug} stories={feed.map(toFeedStory)} nav={nav} activeCategory={slug} />
        </div>

        {/* Desktop: editorial category page */}
        <div className="hidden md:block">
          <section aria-labelledby="category-title" className="enter-band" style={{ backgroundColor: category.tint }}>
            <div className="mx-auto flex max-w-[1680px] items-end justify-between gap-10 px-8 pb-12 pt-16 xl:px-12">
              <div>
                <p className="enter kicker text-ink/65">Category</p>
                <h1 id="category-title" className="enter mt-4 font-serif text-display text-ink [--step:1]">
                  {category.name}
                </h1>
                <p className="enter mt-4 max-w-xl text-[18px] leading-relaxed text-ink/70 [--step:2]">{category.description}</p>
              </div>
              {stories.length > 0 && (
                <Link
                  href={watchPath(undefined, slug)}
                  className="enter group inline-flex h-12 shrink-0 items-center gap-2.5 rounded-full bg-ink px-6 text-[15px] font-medium text-white transition-[background-color,scale] duration-200 hover:bg-ink-2 active:scale-[0.97] [--step:3]"
                >
                  <Play className="size-3.5 fill-current transition-transform duration-200 ease-out-soft group-hover:scale-125" aria-hidden />
                  Watch {category.name} reels
                </Link>
              )}
            </div>
          </section>

          <div className="mx-auto mt-14 grid max-w-[1680px] gap-14 px-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-20 xl:px-12">
            {stories.length === 0 ? (
              <EmptyState
                title={`No ${category.name.toLowerCase()} stories yet.`}
                description="New stories in this category will appear here as soon as they’re published."
                action={{ label: "Browse latest stories", href: "/latest" }}
              />
            ) : (
              <section aria-label={`${category.name} stories`}>
                <p className="enter text-[14px] text-muted [--step:3]">
                  {stories.length} {stories.length === 1 ? "story" : "stories"}
                </p>
                {/* Featured story: image wipe + text lift; supporting cards stagger two per row. */}
                {lead && (
                  <Reveal className="mt-4">
                    <StoryCard story={lead} variant="wide" as="h2" priority reveal />
                  </Reveal>
                )}
                <ul className="mt-6 grid gap-6 sm:grid-cols-2">
                  {rest.map((s, i) => (
                    <Reveal as="li" key={s.id} index={i % 2} className="h-full">
                      <StoryCard story={s} variant="panel" as="h2" className="h-full" />
                    </Reveal>
                  ))}
                </ul>
              </section>
            )}
            {/* Sidebar stays calm: one gentle fade-lift for the whole column. */}
            <Reveal index={2}>
              <Sidebar highlights={highlights} categories={categories} />
            </Reveal>
          </div>
        </div>
      </main>
      <div className="hidden md:block">
        <SiteFooter />
      </div>
    </>
  );
}
