import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VideoFeed } from "@/components/feed/VideoFeed";
import { toFeedStory } from "@/components/feed/types";
import { getNavData } from "@/components/layout/getNavData";
import { getCategory, getFeed } from "@/lib/content";
import { categoryPath } from "@/lib/site";

type Params = { category: string };

export const revalidate = 60;

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
