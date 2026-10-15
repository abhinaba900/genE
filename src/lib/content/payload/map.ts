import type { Author as AuthorDoc, Category as CategoryDoc, Media, Story as StoryDoc, Video } from "@/payload-types";
import type { Author, Category, MediaImage, Story, StorySummary, StoryVideo } from "../types";
import { lexicalToBlocks, readingTime } from "./lexical";

/** Payload docs → gen.E content types. Everything defensive: unpopulated relations map to undefined. */

const obj = <T>(value: unknown): T | undefined => (value && typeof value === "object" ? (value as T) : undefined);

export function toImage(value: unknown, fallbackAlt = ""): MediaImage | undefined {
  const m = obj<Media>(value);
  if (!m?.url || !m.mimeType?.startsWith("image/")) return undefined;
  return {
    src: m.url,
    alt: m.alt ?? fallbackAlt,
    width: m.width ?? 1200,
    height: m.height ?? 800,
    credit: m.credit ?? undefined,
  };
}

export function toVideo(value: unknown, fallbackPoster?: string): StoryVideo | undefined {
  const v = obj<Video>(value);
  if (!v?.url) return undefined;
  const poster = obj<Media>(v.poster)?.url ?? v.posterUrl ?? fallbackPoster ?? "";
  return {
    src: v.url,
    streamSrc: v.playbackUrl || undefined,
    poster,
    duration: v.duration ?? 0,
    width: v.width ?? 720,
    height: v.height ?? 1280,
    captions: obj<Media>(v.captions)?.url ?? undefined,
    mimeType: v.mimeType ?? "video/mp4",
    title: v.title,
  };
}

export function toCategory(value: unknown): Category | undefined {
  const c = obj<CategoryDoc & { _order?: string }>(value);
  if (!c?.slug) return undefined;
  return {
    id: String(c.id),
    slug: c.slug,
    name: c.name,
    description: c.description ?? "",
    tint: c.tint ?? "#ece9e2",
    order: 0,
    featured: Boolean(c.featured),
    image: toImage(c.image, c.name),
  };
}

const UNKNOWN_CATEGORY: Category = { id: "0", slug: "stories", name: "Stories", description: "", tint: "#ece9e2", order: 0 };

export function toAuthor(value: unknown): Author {
  const a = obj<AuthorDoc>(value);
  if (!a) return { id: "0", name: "gen.E", role: "gen.E Newsroom", bio: "" };
  return {
    id: String(a.id),
    slug: a.slug ?? undefined,
    name: a.name,
    role: a.jobTitle ?? "",
    bio: a.bio ?? "",
    photo: toImage(a.photo, a.name),
    socials: (a.socials ?? []).map((s) => ({ platform: s.platform, url: s.url })),
  };
}

/** Returns null when a story lacks what the public site needs (e.g. its video was deleted). */
export function toStorySummary(doc: StoryDoc): StorySummary | null {
  const story = toStory(doc, false);
  if (!story) return null;
  const { body: _body, seo: _seo, ...summary } = story;
  return summary;
}

export function toStory(doc: StoryDoc, withBody = true): Story | null {
  const featured = toImage(doc.featuredImage, doc.title);
  const videoDoc = obj<Video>(doc.video);
  const posterImage = toImage(videoDoc?.poster, doc.title);
  const video = toVideo(doc.video, featured?.src);
  if (!video || !doc.slug) return null;

  const thumbnail: MediaImage = featured ??
    posterImage ?? { src: video.poster, alt: doc.title, width: video.width, height: video.height };
  if (!video.poster) video.poster = thumbnail.src;

  const body = withBody ? lexicalToBlocks(doc.content) : [];
  const seo = doc.seo ?? {};
  return {
    id: String(doc.id),
    slug: doc.slug,
    title: doc.title,
    shortTitle: doc.shortTitle || undefined,
    excerpt: doc.excerpt ?? "",
    category: toCategory(doc.category) ?? UNKNOWN_CATEGORY,
    additionalCategories: (doc.additionalCategories ?? []).map(toCategory).filter((c): c is Category => Boolean(c)),
    tags: (doc.tags ?? []).map((t) => (typeof t === "object" ? t.name : null)).filter((t): t is string => Boolean(t)),
    author: toAuthor(doc.author),
    publishedAt: doc.publishedAt ?? doc.createdAt,
    updatedAt: doc.updatedAt,
    thumbnail,
    video,
    body,
    featured: Boolean(doc.featured),
    // Reading time needs the body; summaries are fetched without it, so they carry a stored estimate.
    readingTime: withBody ? readingTime(body) : (doc as StoryDoc & { readingTime?: number }).readingTime ?? 1,
    seo: {
      title: seo.title ?? undefined,
      description: seo.description ?? undefined,
      image: toImage(seo.image, doc.title),
      ogTitle: doc.seo?.ogTitle ?? undefined,
      ogDescription: doc.seo?.ogDescription ?? undefined,
      canonical: doc.seo?.canonicalUrl ?? undefined,
      noIndex: Boolean(doc.seo?.noIndex),
    },
    noIndex: Boolean(doc.seo?.noIndex),
    isDemo: false,
    sourceUrl: doc.sourceUrl ?? undefined,
  };
}
