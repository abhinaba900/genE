import type { MetadataRoute } from "next";
import { getCategories, getPageSlugs, getStories } from "@/lib/content";

export const revalidate = 3600;
import { absoluteUrl, categoryPath, storyPath } from "@/lib/site";

/**
 * XML sitemap (/sitemap.xml). With a large CMS archive, split this with
 * `generateSitemaps()` (e.g. one sitemap per month of stories).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [stories, categories, pages] = await Promise.all([getStories(), getCategories(), getPageSlugs()]);
  const latest = stories[0]?.publishedAt ?? new Date().toISOString();

  const staticPages: MetadataRoute.Sitemap = ["/", "/latest", "/categories", "/watch"].map(
    (path) => ({ url: absoluteUrl(path), lastModified: path === "/" || path === "/latest" ? latest : undefined, changeFrequency: path === "/" || path === "/latest" ? "hourly" : "monthly" }),
  );

  return [
    ...staticPages,
    ...pages.map((p) => ({ url: absoluteUrl(`/${p.slug}`), lastModified: p.updatedAt, changeFrequency: "monthly" as const })),
    ...categories.map((c) => ({ url: absoluteUrl(categoryPath(c.slug)), lastModified: latest, changeFrequency: "daily" as const })),
    ...stories.filter((s) => !s.noIndex).map((s) => ({
      url: absoluteUrl(storyPath(s.slug)),
      lastModified: s.updatedAt ?? s.publishedAt,
      changeFrequency: "weekly" as const,
      images: [absoluteUrl(s.thumbnail.src)],
      videos: [
        {
          title: s.title,
          thumbnail_loc: absoluteUrl(s.video.poster),
          description: s.excerpt,
          content_loc: absoluteUrl(s.video.src),
          duration: Math.round(s.video.duration),
          publication_date: s.publishedAt,
        },
      ],
    })),
  ];
}
