import "server-only";
import { getCategories, getHighlights, getSiteSettings } from "@/lib/content";
import type { NavData } from "./nav";

export async function getNavData(): Promise<NavData> {
  const [settings, categories, highlights] = await Promise.all([getSiteSettings(), getCategories(), getHighlights(5)]);
  return {
    primary: settings.primaryNav,
    secondary: settings.secondaryNav,
    legal: settings.legalNav,
    categories: categories.map(({ slug, name }) => ({ slug, name })),
    tagline: settings.tagline,
    footer: { text: settings.footerText, copyright: settings.copyright, socials: settings.socials },
    trending: highlights.stories.map((s) => ({ slug: s.slug, title: s.title, category: s.category.name, poster: s.video.poster })),
  };
}
