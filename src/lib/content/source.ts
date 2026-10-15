import type { Category, Highlights, Homepage, Page, SiteSettings, Story, StoryQuery, StorySummary } from "./types";

/**
 * The contract the content backend implements. Today: `payloadSource` (Payload CMS
 * via its Local API). Pages import from `./index`, never from a backend directly.
 */
export interface ContentSource {
  getSiteSettings(): Promise<SiteSettings>;
  getCategories(): Promise<Category[]>;
  getCategory(slug: string): Promise<Category | null>;
  /** Current slug for a renamed category, if `slug` is a retired one. */
  findCategoryRedirect(slug: string): Promise<string | null>;
  /** Published stories, newest first. */
  getStories(query?: StoryQuery): Promise<StorySummary[]>;
  /** The video feed, in the editorially configured order. */
  getFeed(category?: string): Promise<StorySummary[]>;
  /** A published story, or the current slug when `slug` is a retired one. */
  getStory(slug: string): Promise<{ story: Story | null; redirect?: string }>;
  getHomepage(): Promise<Homepage>;
  getHighlights(limit?: number): Promise<Highlights>;
  getRelatedStories(slug: string, limit?: number): Promise<StorySummary[]>;
  searchStories(query: string, limit?: number): Promise<StorySummary[]>;
  getPage(slug: string): Promise<{ page: Page | null; redirect?: string }>;
  getPageSlugs(): Promise<{ slug: string; updatedAt: string }[]>;
}
