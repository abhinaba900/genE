/**
 * Content model for gen.E.
 *
 * These interfaces describe what the UI needs, independent of where the data
 * comes from. The CMS adapter (`./payload`) maps Payload documents onto these
 * shapes — presentation components never see CMS-specific fields.
 */

import type { FormFieldDef } from "@/lib/forms";

export interface MediaImage {
  src: string;
  alt: string;
  width: number;
  height: number;
  credit?: string;
}

export interface StoryVideo {
  /** Progressive file (MP4) — always playable. */
  src: string;
  /**
   * Optional adaptive stream (HLS) from the CMS's "Streaming URL". Not yet used by the
   * players, which play `src`; wire it in (e.g. via hls.js) when a streaming service is added.
   */
  streamSrc?: string;
  /** Poster frame shown before playback. */
  poster: string;
  /** Duration in seconds. */
  duration: number;
  width: number;
  height: number;
  /** Optional WebVTT captions track. */
  captions?: string;
  mimeType?: string;
  title?: string;
}

export interface Author {
  id: string;
  slug?: string;
  name: string;
  role: string;
  bio: string;
  photo?: MediaImage;
  socials?: { platform: string; url: string }[];
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string;
  /** Soft background tint used for cards in this category. */
  tint: string;
  order: number;
  featured?: boolean;
  image?: MediaImage;
}

/** Inline rich text: formatted runs and links. Rendered as React elements, never raw HTML. */
export type InlineNode =
  | { type: "text"; text: string; bold?: boolean; italic?: boolean; underline?: boolean; strike?: boolean; code?: boolean }
  | { type: "link"; href: string; newTab?: boolean; children: InlineNode[] }
  | { type: "break" };
export type RichText = InlineNode[];

export type ArticleBlock =
  | { type: "paragraph"; content: RichText }
  | { type: "heading"; content: RichText; level?: 2 | 3 }
  | { type: "image"; image: MediaImage; caption?: string; layout?: "inline" | "wide" }
  /** Pull quote: large display quote. */
  | { type: "quote"; text: string; attribution?: string }
  /** Block quote: quoted passage within the text flow. */
  | { type: "blockquote"; content: RichText }
  | { type: "list"; style: "bullet" | "number"; items: RichText[] }
  | { type: "video"; video: StoryVideo; caption?: string }
  | { type: "embed"; provider: "youtube" | "vimeo" | "link"; url: string; embedUrl?: string; title?: string; caption?: string }
  | { type: "divider" };

export interface StorySeo {
  title?: string;
  description?: string;
  image?: MediaImage;
  ogTitle?: string;
  ogDescription?: string;
  canonical?: string;
  noIndex?: boolean;
}

/** Story with relations resolved — what components receive. */
export interface Story {
  id: string;
  slug: string;
  title: string;
  /** Shorter headline for the video feed. */
  shortTitle?: string;
  excerpt: string;
  category: Category;
  additionalCategories?: Category[];
  tags: string[];
  author: Author;
  publishedAt: string;
  updatedAt?: string;
  thumbnail: MediaImage;
  video: StoryVideo;
  body: ArticleBlock[];
  featured: boolean;
  readingTime: number;
  seo?: StorySeo;
  /** Excluded from search engines (and the sitemap). */
  noIndex?: boolean;
  /** Marks fictional demonstration content. */
  isDemo: boolean;
  /** Where the film was originally published (e.g. the YouTube Short). */
  sourceUrl?: string;
}

/** Lightweight shape for feeds, cards and search results. */
export type StorySummary = Omit<Story, "body" | "seo">;

export interface NavLink {
  label: string;
  href: string;
}

export interface SiteSettings {
  name: string;
  tagline: string;
  description: string;
  primaryNav: NavLink[];
  secondaryNav: NavLink[];
  legalNav: NavLink[];
  contactEmail?: string;
  socials: { platform: string; url: string }[];
  footerText?: string;
  copyright?: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultShareImage?: MediaImage;
  logo?: MediaImage;
  favicon?: string;
}

export interface StoryQuery {
  category?: string;
  limit?: number;
  offset?: number;
}

/** A titled list for the sidebar: real "Trending" when view data exists, otherwise "Editor's picks". */
export interface Highlights {
  heading: string;
  stories: StorySummary[];
}

export interface Homepage {
  featured: StorySummary | null;
  reels: StorySummary[];
  latest: StorySummary[];
  highlights: Highlights;
  topics: Category[];
}

export type PageBlock =
  | { type: "richText"; id: string; blocks: ArticleBlock[] }
  | { type: "sections"; id: string; items: { heading: string; blocks: ArticleBlock[] }[] }
  | { type: "twoColumn"; id: string; heading: string; blocks: ArticleBlock[] }
  | { type: "pillars"; id: string; heading?: string; items: { title: string; text: string }[] }
  | { type: "statement"; id: string; items: { label: string; text: string }[] }
  | { type: "storyStrip"; id: string; stories: StorySummary[] }
  | { type: "image"; id: string; image: MediaImage; caption?: string }
  | { type: "callToAction"; id: string; text: string; label: string; href: string }
  | { type: "contactDetails"; id: string; items: { label: string; value: string; href?: string }[] }
  | {
      type: "contactForm";
      id: string;
      heading?: string;
      intro?: string;
      submitLabel?: string;
      successMessage?: string;
      fields: FormFieldDef[];
    };

export interface Page {
  id: string;
  slug: string;
  title: string;
  template: "standard" | "feature" | "contact";
  kicker?: string;
  intro?: string;
  notice?: string;
  heroImage?: MediaImage;
  blocks: PageBlock[];
  updatedAt?: string;
  seo?: StorySeo;
}
