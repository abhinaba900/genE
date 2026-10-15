import { revalidateTag } from "next/cache";

/**
 * Cache tags shared by the public data layer (`src/lib/content/payload`) and the CMS hooks.
 * Any content change invalidates the matching tags immediately (`expire: 0`), so an
 * unpublished story is never served from cache after the change commits.
 */
export const TAGS = {
  stories: "cms:stories",
  categories: "cms:categories",
  authors: "cms:authors",
  tags: "cms:tags",
  pages: "cms:pages",
  settings: "cms:settings",
  homepage: "cms:homepage",
  navigation: "cms:navigation",
  analytics: "cms:analytics",
} as const;

export type CacheTag = (typeof TAGS)[keyof typeof TAGS];

export function revalidate(...tags: CacheTag[]) {
  for (const tag of tags) {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch {
      // Outside a Next.js request (seed script, CLI migrations). The data cache's
      // short TTL (see CACHE_TTL in the content layer) covers this case.
    }
  }
}
