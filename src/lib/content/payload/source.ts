import "server-only";
import config from "@payload-config";
import { unstable_cache } from "next/cache";
import { getPayload, type Where } from "payload";
import { publicStoryWhere } from "@/cms/access";
import { TAGS } from "@/cms/revalidate";
import type { Homepage as HomepageDoc, Page as PageDoc, Story as StoryDoc } from "@/payload-types";
import { scoreStory } from "../search";
import type { ContentSource } from "../source";
import { resolveFields } from "@/lib/forms";
import type { Category, Highlights, Homepage, Page, PageBlock, SiteSettings, Story, StorySummary } from "../types";
import { lexicalToBlocks } from "./lexical";
import { type Ordering, ids, orderFeed } from "./feed";
import { toCategory, toImage, toStory, toStorySummary } from "./map";

/**
 * Payload implementation of the content contract, using the Local API (same process,
 * no HTTP hop). Every public query applies `publicStoryWhere()` — published, not
 * archived, publish time passed — regardless of what an editor curated.
 *
 * Results are cached in Next's data cache and tagged; CMS hooks invalidate the tags
 * the moment content changes. CACHE_TTL is only a backstop for changes made outside a
 * request (e.g. the scheduler), so a scheduled story appears within a minute.
 */
const CACHE_TTL = 60;
const MAX_STORIES = 500;

export const payloadClient = () => getPayload({ config });

const LIST_SELECT = { content: false } as const;

async function findStories(where: Where, opts: { limit?: number; sort?: string } = {}): Promise<StorySummary[]> {
  const payload = await payloadClient();
  const res = await payload.find({
    collection: "stories",
    where: { and: [publicStoryWhere(), where] },
    sort: [opts.sort ?? "-publishedAt", "-id"],
    limit: opts.limit ?? MAX_STORIES,
    depth: 2,
    select: LIST_SELECT,
    overrideAccess: true,
  });
  return (res.docs as StoryDoc[]).map(toStorySummary).filter((s): s is StorySummary => Boolean(s));
}

function categoryWhere(slug?: string): Where {
  if (!slug) return {};
  return { or: [{ "category.slug": { equals: slug } }, { "additionalCategories.slug": { equals: slug } }] };
}

const cached = <A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string, tags: string[]) =>
  unstable_cache(fn, [key], { tags, revalidate: CACHE_TTL });

// ── Settings & taxonomy ──

const getSettings = cached(
  async (): Promise<SiteSettings> => {
    const payload = await payloadClient();
    const [settings, nav] = await Promise.all([
      payload.findGlobal({ slug: "site-settings", depth: 1, overrideAccess: true }),
      payload.findGlobal({ slug: "navigation", depth: 0, overrideAccess: true }),
    ]);
    const links = (list?: { label: string; href: string }[] | null) => (list ?? []).map(({ label, href }) => ({ label, href }));
    return {
      name: settings.siteName || "gen.E",
      tagline: settings.tagline ?? "",
      description: settings.description ?? "",
      primaryNav: links(nav.primary),
      secondaryNav: links(nav.secondary),
      legalNav: links(nav.legal),
      contactEmail: settings.contactEmail ?? undefined,
      socials: (settings.socials ?? []).map((s) => ({ platform: s.platform, url: s.url })),
      footerText: settings.footerText ?? undefined,
      copyright: settings.copyright ?? undefined,
      defaultTitle: settings.defaultTitle ?? undefined,
      defaultDescription: settings.defaultDescription ?? undefined,
      defaultShareImage: toImage(settings.defaultShareImage),
      logo: toImage(settings.logo, settings.siteName ?? "gen.E"),
      favicon: toImage(settings.favicon)?.src,
    };
  },
  "settings",
  [TAGS.settings, TAGS.navigation],
);

const getAllCategories = cached(
  async (): Promise<Category[]> => {
    const payload = await payloadClient();
    const res = await payload.find({
      collection: "categories",
      where: { enabled: { equals: true } },
      sort: "_order",
      limit: 200,
      depth: 1,
      overrideAccess: true,
    });
    return res.docs.map(toCategory).filter((c): c is Category => Boolean(c)).map((c, i) => ({ ...c, order: i + 1 }));
  },
  "categories",
  [TAGS.categories],
);

// ── Stories ──

const getStoryList = cached(
  async (category?: string, limit?: number, offset: number = 0): Promise<StorySummary[]> => {
    const list = await findStories(categoryWhere(category), { limit: limit ? limit + offset : undefined });
    return list.slice(offset, limit ? offset + limit : undefined);
  },
  "stories:list",
  [TAGS.stories, TAGS.categories, TAGS.authors],
);

const getStoryBySlug = cached(
  async (slug: string): Promise<{ story: Story | null; redirect?: string }> => {
    const payload = await payloadClient();
    const res = await payload.find({
      collection: "stories",
      where: { and: [publicStoryWhere(), { slug: { equals: slug } }] },
      limit: 1,
      depth: 2,
      overrideAccess: true,
    });
    const doc = res.docs[0] as StoryDoc | undefined;
    if (doc) return { story: toStory(doc) };
    // Renamed story: find it by a retired slug and send readers to the current URL.
    const moved = await payload.find({
      collection: "stories",
      where: { and: [publicStoryWhere(), { previousSlugs: { in: [slug] } }] },
      limit: 1,
      depth: 0,
      select: { slug: true },
      overrideAccess: true,
    });
    return { story: null, redirect: moved.docs[0]?.slug ?? undefined };
  },
  "stories:slug",
  [TAGS.stories, TAGS.categories, TAGS.authors],
);

// ── Feed & homepage ──

const getHomepageDoc = cached(
  async (): Promise<HomepageDoc> => {
    const payload = await payloadClient();
    return payload.findGlobal({ slug: "homepage", depth: 0, overrideAccess: true });
  },
  "homepage",
  [TAGS.homepage],
);

const getFeedStories = cached(
  async (category?: string) => {
    const payload = await payloadClient();
    const [config, all] = await Promise.all([
      getHomepageDoc(),
      findStories({ and: [categoryWhere(category), { hideFromFeed: { not_equals: true } }] }),
    ]);
    if (!category) return orderFeed(all, (config.feedOrdering ?? "latest") as Ordering, ids(config.pinned), ids(config.curated));

    const cats = await payload.find({ collection: "categories", where: { slug: { equals: category } }, limit: 1, depth: 0, overrideAccess: true });
    const catId = String(cats.docs[0]?.id ?? "");
    const override = (config.categoryFeeds ?? []).find((f) => String(typeof f.category === "object" ? f.category?.id : f.category) === catId);
    if (!override) return all;
    return orderFeed(all, (override.ordering ?? "latest") as Ordering, ids(override.pinned), ids(override.curated));
  },
  "feed",
  [TAGS.stories, TAGS.homepage, TAGS.categories],
);

const trendingIds = cached(
  async (limit: number): Promise<string[]> => {
    const payload = await payloadClient();
    const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const { docs } = await payload.find({
      collection: "analytics-events",
      where: { and: [{ createdAt: { greater_than_equal: since } }, { type: { in: ["page_view", "video_start"] } }, { story: { exists: true } }] },
      limit: 20000,
      depth: 0,
      select: { story: true },
      overrideAccess: true,
    });
    // Require a meaningful sample before calling anything "trending".
    if (docs.length < 25) return [];
    const counts = new Map<string, number>();
    for (const d of docs) {
      const id = String(typeof d.story === "object" ? d.story?.id : d.story);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || Number(b[0]) - Number(a[0])).slice(0, limit).map(([id]) => id);
  },
  "trending",
  [TAGS.analytics],
);

async function highlights(limit = 5, configDoc?: HomepageDoc): Promise<Highlights> {
  const [config, all] = await Promise.all([configDoc ?? getHomepageDoc(), getStoryList()]);
  const byId = new Map(all.map((s) => [s.id, s]));
  if (config.sidebarMode !== "picks") {
    const trending = (await trendingIds(limit)).map((id) => byId.get(id)).filter((s): s is StorySummary => Boolean(s));
    if (trending.length >= 3) return { heading: "Trending", stories: trending };
  }
  const picks = ids(config.editorsPicks).map((id) => byId.get(id)).filter((s): s is StorySummary => Boolean(s));
  if (picks.length) return { heading: "Editor’s picks", stories: picks.slice(0, limit) };
  return { heading: "Latest", stories: all.slice(0, limit) };
}

/** Mobile feed order for a given homepage configuration (used directly by the draft preview). */
export async function buildFeed(config: HomepageDoc): Promise<StorySummary[]> {
  const all = await findStories({ hideFromFeed: { not_equals: true } });
  return orderFeed(all, (config.feedOrdering ?? "latest") as Ordering, ids(config.pinned), ids(config.curated));
}

export async function homepage(configDoc?: HomepageDoc): Promise<Homepage> {
  const [config, feed, all, categories, side] = await Promise.all([
    configDoc ?? getHomepageDoc(),
    configDoc ? buildFeed(configDoc) : getFeedStories(),
    getStoryList(),
    getAllCategories(),
    highlights(5, configDoc),
  ]);
  const visible = all.filter((s) => feed.some((f) => f.id === s.id));
  const byId = new Map(all.map((s) => [s.id, s]));
  const mainId = config.mainFeatured ? ids([config.mainFeatured])[0] : undefined;
  const featured = (mainId && byId.get(mainId)) || visible.find((s) => s.featured) || visible[0] || null;
  const rest = visible.filter((s) => s.id !== featured?.id);
  const chosenReels = ids(config.secondaryFeatured).map((id) => byId.get(id)).filter((s): s is StorySummary => Boolean(s) && s!.id !== featured?.id);
  const reels = [...chosenReels, ...rest.filter((s) => !chosenReels.some((r) => r.id === s.id))].slice(0, 5);
  const latest = rest.filter((s) => !reels.some((r) => r.id === s.id)).slice(0, config.latestCount ?? 5);
  const topicIds = ids(config.topicCategories);
  const topics = topicIds.length ? (topicIds.map((id) => categories.find((c) => c.id === id)).filter(Boolean) as Category[]) : categories;
  return { featured, reels, latest, highlights: side, topics };
}

// ── Search & related ──

async function search(query: string, limit = 20): Promise<StorySummary[]> {
  const q = query.trim().slice(0, 120);
  if (!q) return [];
  const terms = q.split(/\s+/).filter((t) => t.length > 1).slice(0, 6);
  if (!terms.length) return [];
  const where: Where = {
    or: terms.flatMap((t): Where[] => [
      { title: { like: t } },
      { shortTitle: { like: t } },
      { excerpt: { like: t } },
      { "tags.name": { like: t } },
      { "category.name": { like: t } },
    ]),
  };
  const candidates = await findStories(where, { limit: 200 });
  return candidates
    .map((s) => ({ s, score: scoreStory(s, q) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || +new Date(b.s.publishedAt) - +new Date(a.s.publishedAt))
    .slice(0, limit)
    .map(({ s }) => s);
}

async function related(slug: string, limit = 3): Promise<StorySummary[]> {
  const all = await getStoryList();
  const story = all.find((s) => s.slug === slug);
  if (!story) return [];
  return all
    .filter((s) => s.slug !== slug)
    .map((s) => ({
      s,
      score: (s.category.slug === story.category.slug ? 5 : 0) + s.tags.filter((t) => story.tags.includes(t)).length * 2,
    }))
    .sort((a, b) => b.score - a.score || +new Date(b.s.publishedAt) - +new Date(a.s.publishedAt))
    .slice(0, limit)
    .map(({ s }) => s);
}

// ── Pages ──

export async function toPage(doc: PageDoc): Promise<Page> {
  const blocks: PageBlock[] = [];
  for (const block of doc.layout ?? []) {
    const id = block.id ?? `${block.blockType}-${blocks.length}`;
    switch (block.blockType) {
      case "richText":
        blocks.push({ type: "richText", id, blocks: lexicalToBlocks(block.content) });
        break;
      case "sections":
        blocks.push({ type: "sections", id, items: (block.items ?? []).map((i) => ({ heading: i.heading, blocks: lexicalToBlocks(i.content) })) });
        break;
      case "twoColumn":
        blocks.push({ type: "twoColumn", id, heading: block.heading, blocks: lexicalToBlocks(block.content) });
        break;
      case "pillars":
        blocks.push({ type: "pillars", id, heading: block.heading ?? undefined, items: (block.items ?? []).map(({ title, text }) => ({ title, text })) });
        break;
      case "statement":
        blocks.push({ type: "statement", id, items: (block.items ?? []).map(({ label, text }) => ({ label, text })) });
        break;
      case "storyStrip":
        blocks.push({ type: "storyStrip", id, stories: await getStoryList(undefined, block.count ?? 4) });
        break;
      case "image": {
        const image = toImage(block.image);
        if (image) blocks.push({ type: "image", id, image, caption: block.caption ?? undefined });
        break;
      }
      case "callToAction":
        blocks.push({ type: "callToAction", id, text: block.text, label: block.label, href: block.href });
        break;
      case "contactDetails":
        blocks.push({ type: "contactDetails", id, items: (block.items ?? []).map(({ label, value, href }) => ({ label, value, href: href ?? undefined })) });
        break;
      case "contactForm":
        blocks.push({
          type: "contactForm",
          id,
          heading: block.heading ?? undefined,
          intro: block.intro ?? undefined,
          submitLabel: block.submitLabel ?? undefined,
          successMessage: block.successMessage ?? undefined,
          fields: resolveFields(
            (block.fields ?? []).map((f) => ({
              label: f.label,
              type: f.type,
              required: f.required ?? false,
              placeholder: f.placeholder ?? undefined,
              options: f.options ?? undefined,
              width: f.width ?? "full",
            })),
          ),
        });
        break;
    }
  }
  return {
    id: String(doc.id),
    slug: doc.slug ?? "",
    title: doc.title,
    template: (doc.template ?? "standard") as Page["template"],
    kicker: doc.kicker ?? undefined,
    intro: doc.intro ?? undefined,
    notice: doc.notice ?? undefined,
    heroImage: toImage(doc.heroImage, doc.title),
    blocks,
    updatedAt: doc.updatedAt,
    seo: {
      title: doc.seo?.title ?? undefined,
      description: doc.seo?.description ?? undefined,
      image: toImage(doc.seo?.image, doc.title),
      noIndex: Boolean(doc.seo?.noIndex),
    },
  };
}

const getPageBySlug = cached(
  async (slug: string): Promise<{ page: Page | null; redirect?: string }> => {
    const payload = await payloadClient();
    const res = await payload.find({
      collection: "pages",
      where: { and: [{ _status: { equals: "published" } }, { or: [{ slug: { equals: slug } }, { previousSlugs: { in: [slug] } }] }] },
      limit: 1,
      depth: 2,
      overrideAccess: true,
    });
    const doc = res.docs[0] as PageDoc | undefined;
    if (!doc) return { page: null };
    if (doc.slug !== slug) return { page: null, redirect: doc.slug ?? undefined };
    return { page: await toPage(doc) };
  },
  "pages:slug",
  [TAGS.pages, TAGS.stories],
);

const getPageSlugs = cached(
  async (): Promise<{ slug: string; updatedAt: string }[]> => {
    const payload = await payloadClient();
    const res = await payload.find({
      collection: "pages",
      where: { and: [{ _status: { equals: "published" } }, { "seo.noIndex": { not_equals: true } }] },
      limit: 200,
      depth: 0,
      select: { slug: true, updatedAt: true },
      overrideAccess: true,
    });
    return res.docs.map((d) => ({ slug: d.slug ?? "", updatedAt: d.updatedAt })).filter((d) => d.slug);
  },
  "pages:slugs",
  [TAGS.pages],
);

export const payloadSource: ContentSource = {
  getSiteSettings: () => getSettings(),
  getCategories: () => getAllCategories(),
  async getCategory(slug) {
    return (await getAllCategories()).find((c) => c.slug === slug) ?? null;
  },
  async findCategoryRedirect(slug) {
    const payload = await payloadClient();
    const res = await payload.find({
      collection: "categories",
      where: { and: [{ enabled: { equals: true } }, { previousSlugs: { in: [slug] } }] },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    });
    return res.docs[0]?.slug ?? null;
  },
  getStories: ({ category, limit, offset } = {}) => getStoryList(category, limit, offset),
  getFeed: (category) => getFeedStories(category),
  getStory: (slug) => getStoryBySlug(slug),
  getHomepage: () => homepage(),
  getHighlights: (limit) => highlights(limit),
  getRelatedStories: (slug, limit) => related(slug, limit),
  searchStories: (query, limit) => search(query, limit),
  getPage: (slug) => getPageBySlug(slug),
  getPageSlugs: () => getPageSlugs(),
};
