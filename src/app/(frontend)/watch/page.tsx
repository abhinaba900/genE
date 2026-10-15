import type { Metadata } from "next";
import { VideoFeed } from "@/components/feed/VideoFeed";
import { toFeedStory } from "@/components/feed/types";
import { getNavData } from "@/components/layout/getNavData";
import { getFeed } from "@/lib/content";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Watch",
  description: "Every gen.E story as a short vertical film. Swipe, scroll or use your arrow keys to move between stories.",
  alternates: { canonical: "/watch" },
};

/** The reel on any screen size — full-bleed on phones, a framed 9:16 column on desktop. */
export default async function WatchPage() {
  const [stories, nav] = await Promise.all([getFeed(), getNavData()]);
  return (
    <main id="main">
      <h1 className="sr-only">Watch gen.E stories</h1>
      <VideoFeed stories={stories.map(toFeedStory)} nav={nav} variant="standalone" />
    </main>
  );
}
