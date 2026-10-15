import type { StorySummary } from "@/lib/content/types";

/** Minimal, serializable story shape sent to the client-side reel feed. */
export interface FeedStory {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: { slug: string; name: string };
  readingTime: number;
  isDemo: boolean;
  video: { src: string; poster: string; duration: number; width: number; height: number; mimeType?: string; captions?: string };
}

export function toFeedStory(s: StorySummary): FeedStory {
  return {
    id: s.id,
    slug: s.slug,
    title: s.shortTitle || s.title,
    excerpt: s.excerpt,
    category: { slug: s.category.slug, name: s.category.name },
    readingTime: s.readingTime,
    isDemo: s.isDemo,
    video: {
      src: s.video.src,
      poster: s.video.poster,
      duration: s.video.duration,
      width: s.video.width,
      height: s.video.height,
      mimeType: s.video.mimeType,
      captions: s.video.captions,
    },
  };
}
