import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { StoryArticle } from "@/components/article/StoryArticle";
import { getRelatedStories, getStory } from "@/lib/content";
import { absoluteUrl, storyPath, SITE_NAME } from "@/lib/site";

type Params = { slug: string };

// Rendered on first request, then cached until the story changes in the CMS.
export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const { story } = await getStory(slug);
  if (!story) return { title: "Story not found", robots: { index: false } };
  const url = storyPath(story.slug);
  const seo = story.seo ?? {};
  const title = seo.title || story.title;
  const description = seo.description || story.excerpt;
  const share = seo.image ?? story.thumbnail;
  return {
    title,
    description,
    keywords: story.tags,
    authors: [{ name: story.author.name }],
    alternates: { canonical: seo.canonical || url },
    robots: seo.noIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      siteName: SITE_NAME,
      type: "article",
      url,
      title: seo.ogTitle || title,
      description: seo.ogDescription || description,
      publishedTime: story.publishedAt,
      modifiedTime: story.updatedAt ?? story.publishedAt,
      section: story.category.name,
      tags: story.tags,
      authors: [story.author.name],
      images: [{ url: share.src, width: share.width, height: share.height, alt: share.alt }],
      videos: [{ url: absoluteUrl(story.video.src), width: story.video.width, height: story.video.height, type: "video/mp4" }],
    },
    twitter: {
      card: "summary_large_image",
      title: seo.ogTitle || title,
      description: seo.ogDescription || description,
      images: [share.src],
    },
  };
}

export default async function StoryPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const { story, redirect } = await getStory(slug);
  if (!story) {
    if (redirect) permanentRedirect(storyPath(redirect));
    notFound();
  }
  const related = await getRelatedStories(slug, 4);
  return <StoryArticle story={story} related={related} />;
}
