import "server-only";
import { cache } from "react";
import { payloadSource } from "./payload/source";
import type { ContentSource } from "./source";

/**
 * Data access layer. Pages and components import content from here — never from the
 * CMS directly — so the backend stays swappable behind `ContentSource`.
 * React `cache()` de-duplicates calls within one render; the source adds a tagged
 * data cache across requests.
 */
const source: ContentSource = payloadSource;

export const getSiteSettings = cache(() => source.getSiteSettings());
export const getCategories = cache(() => source.getCategories());
export const getCategory = cache((slug: string) => source.getCategory(slug));
export const findCategoryRedirect = cache((slug: string) => source.findCategoryRedirect(slug));
export const getStories = cache((category?: string, limit?: number) => source.getStories({ category, limit }));
export const getFeed = cache((category?: string) => source.getFeed(category));
export const getStory = cache((slug: string) => source.getStory(slug));
export const getHomepage = cache(() => source.getHomepage());
export const getHighlights = cache((limit?: number) => source.getHighlights(limit));
export const getRelatedStories = cache((slug: string, limit?: number) => source.getRelatedStories(slug, limit));
export const searchStories = (query: string, limit?: number) => source.searchStories(query, limit);
export const getPage = cache((slug: string) => source.getPage(slug));
export const getPageSlugs = cache(() => source.getPageSlugs());

export type * from "./types";
