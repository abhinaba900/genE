import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ArticleBody } from "@/components/article/ArticleBody";
import { StoryArticle } from "@/components/article/StoryArticle";
import { VideoFeed } from "@/components/feed/VideoFeed";
import { toFeedStory } from "@/components/feed/types";
import { getNavData } from "@/components/layout/getNavData";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PreviewBar } from "@/components/preview/PreviewBar";
import { getPreviewStory, previewUser } from "@/lib/content/payload/preview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preview", robots: { index: false, follow: false } };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> };

/** Draft story preview for signed-in CMS users: the article, or the story as it appears in the mobile feed. */
export default async function StoryPreviewPage({ params, searchParams }: Props) {
  const [{ id }, { view }] = await Promise.all([params, searchParams]);
  if (!(await previewUser())) redirect(`/admin/login?redirect=${encodeURIComponent(`/preview/stories/${id}`)}`);

  const [{ story, fallback, status, live }, nav] = await Promise.all([getPreviewStory(id), getNavData()]);
  const base = `/preview/stories/${id}`;
  const views = [
    { label: "Article", href: base, active: view !== "feed" },
    { label: "In the feed", href: `${base}?view=feed`, active: view === "feed" },
  ];
  const bar = (
    <PreviewBar label={!live ? "not published" : status === "published" ? "live version" : "unpublished changes"} status={status} editHref={`/admin/collections/stories/${id}`} views={story ? views : undefined} />
  );

  if (!story) {
    return (
      <>
        <SiteHeader />
        <main id="main" className="pb-24">
          <div className="mx-auto max-w-[680px] px-5 pt-12">
            <p className="rounded-xl border border-dashed border-ink/25 px-5 py-4 text-[14px] text-ink/70">
              {fallback?.missing.length ? `Still needed before this can be published: ${fallback.missing.join(", ")}.` : "This story can't be previewed yet."}
            </p>
            <h1 className="mt-10 font-serif text-display text-ink">{fallback?.title ?? "Story not found"}</h1>
            {fallback?.excerpt && <p className="mt-6 font-serif text-[21px] leading-[1.5] text-ink/70">{fallback.excerpt}</p>}
          </div>
          {fallback && (
            <div className="mt-12">
              <ArticleBody blocks={fallback.body} title={fallback.title} />
            </div>
          )}
        </main>
        {bar}
      </>
    );
  }

  if (view === "feed") {
    return (
      <main id="main">
        <h1 className="sr-only">Feed preview: {story.title}</h1>
        <VideoFeed stories={[toFeedStory(story)]} nav={nav} variant="standalone" />
        {bar}
      </main>
    );
  }

  return (
    <>
      <StoryArticle story={story} related={[]} preview />
      {bar}
    </>
  );
}
