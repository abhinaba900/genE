import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VideoFeed } from "@/components/feed/VideoFeed";
import { toFeedStory } from "@/components/feed/types";
import { getNavData } from "@/components/layout/getNavData";
import { getCategories, getCategory, getFeed } from "@/lib/content";
import { categoryPath } from "@/lib/site";

type Params = { category: string };

export const revalidate = 60;

/**
 * Pre-render every category (revalidated like the rest of the site). Swiping between
 * categories prefetches the neighbours; static pages make that prefetch complete, so the
 * next reel is already on the device when the swipe ends — no server round trip.
 * Categories added later still render on first request (`dynamicParams` stays on).
 */
export async function generateStaticParams() {
  return (await getCategories()).map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { category: slug } = await params;
  const category = await getCategory(slug);
  if (!category) return { title: "Category not found" };
  // The editorial category page is the canonical, indexable version.
  return { title: `Watch ${category.name}`, description: category.description, alternates: { canonical: categoryPath(slug) } };
}

export default async function WatchCategoryPage({ params }: { params: Promise<Params> }) {
  const { category: slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();
  const [stories, nav] = await Promise.all([getFeed(slug), getNavData()]);
  return (
    <main id="main">
      <h1 className="sr-only">Watch {category.name} stories</h1>
      <VideoFeed key={slug} stories={stories.map(toFeedStory)} nav={nav} activeCategory={slug} variant="standalone" />
    </main>
  );
}
