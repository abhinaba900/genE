/**
 * Seeds the CMS with gen.E's existing content: the 19 gen.E films (videos, posters and
 * stills uploaded to the configured storage), their articles, categories, the newsroom
 * author, site settings, navigation, and the About / Contact / Privacy / Terms pages.
 *
 *   npm run seed
 *
 * Idempotent: anything that already exists (matched by slug / filename) is skipped.
 *
 * Optional accounts — only created when the variables are set (e.g. in .env.local):
 *   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD     an administrator
 *   SEED_EDITOR_EMAIL / SEED_EDITOR_PASSWORD   an editor   (useful for testing workflows)
 *   SEED_AUTHOR_EMAIL / SEED_AUTHOR_PASSWORD   an author
 * Without them, create the first administrator in the browser at /admin.
 */
import fs from "node:fs";
import path from "node:path";
import config from "@payload-config";
import { getPayload, type Payload } from "payload";

const ROOT = process.cwd();
const MEDIA = path.join(ROOT, "public", "media");
const FRAME = { width: 720, height: 1280 };

interface ImportedVideo {
  youtubeId: string;
  slug: string;
  title: string;
  paragraphs: string[];
  publishedAt: string;
  duration: number;
  tags: string[];
  category: string;
  featured: boolean;
  sourceUrl: string;
}

const CATEGORIES = [
  { slug: "environment", name: "Environment", tint: "#dfe5d5", description: "Climate, water, forests and the land around us." },
  { slug: "waste-and-recycling", name: "Waste & Recycling", tint: "#ece4d6", description: "Circular ideas that turn waste into something useful." },
  { slug: "innovation", name: "Innovation", tint: "#dae2ea", description: "Startups and technology building practical solutions." },
  { slug: "cities-and-living", name: "Cities & Living", tint: "#e6dde9", description: "Homes, buildings and spaces designed with nature in mind." },
  { slug: "energy", name: "Energy", tint: "#f1e6c8", description: "Solar, storage and the shift to cleaner power." },
  { slug: "mobility", name: "Mobility", tint: "#e5e4d3", description: "How people and goods move — and how they could move more cleanly." },
  { slug: "food-and-farming", name: "Food & Farming", tint: "#e3e8cf", description: "What we grow and eat, and the people rethinking it." },
  { slug: "society", name: "Society", tint: "#efdfd7", description: "Culture, conversations, careers and communities." },
];

// ── Lexical helpers ──
const text = (t: string) => ({ type: "text", text: t, format: 0, detail: 0, mode: "normal", style: "", version: 1 });
const paragraph = (t: string) => ({ type: "paragraph", version: 1, children: [text(t)], direction: "ltr", format: "", indent: 0, textFormat: 0, textStyle: "" });
const upload = (id: number, caption: string) => ({
  type: "upload",
  version: 3,
  format: "",
  id: Math.random().toString(36).slice(2, 12),
  relationTo: "media",
  value: id,
  fields: { caption, layout: "inline" },
});
const root = (children: unknown[]) => ({ root: { type: "root", version: 1, direction: "ltr", format: "", indent: 0, children } });
const prose = (...paras: string[]) => root(paras.map(paragraph));

function excerptFrom(paragraphs: string[]) {
  let t = paragraphs[0] ?? "";
  if (t.length < 100 && paragraphs[1]) {
    const next = paragraphs[1].match(/^.*?[.!?](\s|$)/)?.[0] ?? paragraphs[1];
    t = `${t} ${next.trim()}`;
  }
  if (t.length > 270) t = `${t.slice(0, 267).replace(/\s+\S*$/, "")}…`;
  return t;
}

async function findOne(payload: Payload, collection: "categories" | "authors" | "tags" | "stories" | "pages" | "media" | "videos" | "users", field: string, value: string) {
  const res = await payload.find({ collection, where: { [field]: { equals: value } }, limit: 1, depth: 0, overrideAccess: true, trash: collection === "stories" });
  return res.docs[0] as { id: number } | undefined;
}

async function ensureUser(payload: Payload, role: "admin" | "editor" | "author", email?: string, password?: string, authorProfile?: number) {
  if (!email || !password) return;
  if (await findOne(payload, "users", "email", email)) return;
  await payload.create({
    collection: "users",
    data: { email, password, name: `${role[0].toUpperCase()}${role.slice(1)} (seed)`, role, authorProfile },
    overrideAccess: true,
  });
  payload.logger.info(`Created ${role} account ${email}`);
}

async function uploadMedia(payload: Payload, file: string, alt: string, credit = "gen.E") {
  const filename = path.basename(file);
  const existing = await findOne(payload, "media", "filename", filename);
  if (existing) return existing.id;
  const doc = await payload.create({ collection: "media", data: { alt, credit }, filePath: file, overrideAccess: true });
  return doc.id;
}

async function seed() {
  const payload = await getPayload({ config });
  const log = (msg: string) => payload.logger.info(msg);
  const imported = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "seed-data", "gen-e-videos.json"), "utf8")) as ImportedVideo[];

  // ── Taxonomy & author ──
  const categoryIds = new Map<string, number>();
  for (const c of CATEGORIES) {
    const existing = await findOne(payload, "categories", "slug", c.slug);
    const id = existing?.id ?? (await payload.create({ collection: "categories", data: { ...c, enabled: true }, overrideAccess: true })).id;
    categoryIds.set(c.slug, id);
  }
  log(`Categories: ${categoryIds.size}`);

  const author =
    (await findOne(payload, "authors", "slug", "gen-e")) ??
    (await payload.create({
      collection: "authors",
      data: { name: "gen.E", slug: "gen-e", jobTitle: "gen.E Newsroom", bio: "Short films and stories from the gen.E team.", active: true },
      overrideAccess: true,
    }));

  await ensureUser(payload, "admin", process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD, author.id);
  await ensureUser(payload, "editor", process.env.SEED_EDITOR_EMAIL, process.env.SEED_EDITOR_PASSWORD, author.id);
  await ensureUser(payload, "author", process.env.SEED_AUTHOR_EMAIL, process.env.SEED_AUTHOR_PASSWORD, author.id);

  const tagIds = new Map<string, number>();
  const tagId = async (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) return undefined;
    if (tagIds.has(slug)) return tagIds.get(slug);
    const existing = await findOne(payload, "tags", "slug", slug);
    const id = existing?.id ?? (await payload.create({ collection: "tags", data: { name, slug }, overrideAccess: true })).id;
    tagIds.set(slug, id);
    return id;
  };

  // ── Stories (oldest first so ids follow publication order) ──
  const ordered = [...imported].sort((a, b) => +new Date(a.publishedAt) - +new Date(b.publishedAt));
  for (const [i, v] of ordered.entries()) {
    if (await findOne(payload, "stories", "slug", v.slug)) {
      log(`[${i + 1}/${ordered.length}] exists: ${v.slug}`);
      continue;
    }
    log(`[${i + 1}/${ordered.length}] ${v.title}`);
    const posterId = await uploadMedia(payload, path.join(MEDIA, "posters", `${v.slug}.jpg`), `Poster frame from the film “${v.title}”`);
    const still1 = await uploadMedia(payload, path.join(MEDIA, "images", `${v.slug}-1.jpg`), `A still from the film “${v.title}”`);
    const still2 = await uploadMedia(payload, path.join(MEDIA, "images", `${v.slug}-2.jpg`), `A still from the film “${v.title}”`);

    const videoFile = path.join(MEDIA, "video", `${v.slug}.mp4`);
    const video =
      (await findOne(payload, "videos", "filename", `${v.slug}.mp4`)) ??
      (await payload.create({
        collection: "videos",
        data: { title: v.title, description: v.paragraphs[0], poster: posterId, duration: v.duration, ...FRAME, startMuted: true },
        filePath: videoFile,
        overrideAccess: true,
      }));

    // Article: the film's description, with stills between paragraphs (as on the original site).
    const children: unknown[] = [];
    v.paragraphs.forEach((p, idx) => {
      children.push(paragraph(p));
      if (idx === 1) children.push(upload(still1, "A still from the gen.E film."));
      if (idx === 3) children.push(upload(still2, "A still from the gen.E film."));
    });
    if (v.paragraphs.length < 2) children.push(upload(still1, "A still from the gen.E film."));

    const tags = (await Promise.all(v.tags.map(tagId))).filter((t): t is number => Boolean(t));
    await payload.create({
      collection: "stories",
      data: {
        title: v.title,
        slug: v.slug,
        excerpt: excerptFrom(v.paragraphs),
        category: categoryIds.get(v.category)!,
        author: author.id,
        tags,
        video: video.id,
        content: root(children) as never,
        featured: v.featured,
        publishedAt: v.publishedAt,
        sourceUrl: v.sourceUrl,
        _status: "published",
      },
      context: { systemPublish: true },
      overrideAccess: true,
    });
  }

  // ── Globals ──
  await payload.updateGlobal({
    slug: "site-settings",
    data: {
      siteName: "gen.E",
      tagline: "Watch the story. Explore the details.",
      description: "gen.E is a video-first news platform. Discover stories through short vertical films, then explore the full story.",
      footerText: "Films and stories by gen.E.",
      copyright: "gen.E",
      socials: [{ platform: "youtube", url: "https://www.youtube.com/@gen.e_media" }],
    },
    overrideAccess: true,
  });
  await payload.updateGlobal({
    slug: "navigation",
    data: {
      primary: [
        { label: "Home", href: "/" },
        { label: "Latest stories", href: "/latest" },
        { label: "Categories", href: "/categories" },
        { label: "Watch", href: "/watch" },
      ],
      secondary: [
        { label: "About gen.E", href: "/about" },
        { label: "Contact", href: "/contact" },
        { label: "Search", href: "/search" },
      ],
      legal: [
        { label: "Privacy", href: "/privacy" },
        { label: "Terms", href: "/terms" },
      ],
    },
    overrideAccess: true,
  });
  await payload.updateGlobal({
    slug: "homepage",
    data: { feedOrdering: "latest", latestCount: 5, sidebarMode: "auto", _status: "published" },
    overrideAccess: true,
  });

  // ── Pages (copy carried over from the previous hard-coded pages, placeholders kept visibly marked) ──
  const LEGAL = "[Placeholder — to be written and approved by gen.E's legal advisers.]";
  const pages = [
    {
      slug: "about",
      title: "A new way to experience journalism.",
      template: "feature",
      kicker: "About gen.E",
      seo: { title: "About", description: "gen.E is a video-first news platform: watch the story, then explore the details." },
      layout: [
        { blockType: "storyStrip", count: 4 },
        {
          blockType: "pillars",
          heading: "How gen.E works",
          items: [
            { title: "Watch the story", text: "Every story begins as a short vertical film — the essence of the reporting, made for the way people discover news today." },
            { title: "Explore the details", text: "Behind every film sits a full article: context, voices, images and the depth a minute of video can’t hold." },
            { title: "Share what matters", text: "Every story has its own link, built to be passed on — to a friend, a group chat or a feed." },
          ],
        },
        {
          blockType: "twoColumn",
          heading: "Our story",
          content: prose("[Placeholder — gen.E’s founding story, in the organisation’s own words.]", "[Placeholder — who is behind gen.E and why it was started.]"),
        },
        {
          blockType: "statement",
          items: [
            { label: "Mission", text: "[Placeholder — gen.E’s mission statement.]" },
            { label: "Vision", text: "[Placeholder — gen.E’s long-term vision.]" },
          ],
        },
        { blockType: "callToAction", text: "Questions, ideas or a story we should tell?", label: "Get in touch", href: "/contact" },
      ],
    },
    {
      slug: "contact",
      title: "Say hello.",
      template: "contact",
      kicker: "Contact",
      intro: "Story tips, partnerships, press or feedback — tell us what’s on your mind.",
      seo: { title: "Contact", description: "Get in touch with the gen.E team." },
      layout: [
        {
          blockType: "contactDetails",
          items: [
            { label: "Email", value: "[Placeholder — contact email]" },
            { label: "Newsroom", value: "[Placeholder — address]" },
          ],
        },
        { blockType: "contactForm", heading: "Send a message" },
      ],
    },
    {
      slug: "privacy",
      title: "Privacy policy",
      template: "standard",
      kicker: "Legal",
      intro: "This page will explain what information gen.E collects, why, and the choices readers have.",
      notice: "This is a layout placeholder, not a privacy policy. Replace every section below with reviewed policy text before launch.",
      seo: { title: "Privacy", description: "gen.E privacy policy." },
      layout: [
        {
          blockType: "sections",
          items: ["Who we are", "Information we collect", "How we use information", "Cookies and analytics", "Your rights", "Contact"].map((heading) => ({ heading, content: prose(LEGAL) })),
        },
      ],
    },
    {
      slug: "terms",
      title: "Terms of use",
      template: "standard",
      kicker: "Legal",
      intro: "This page will set out the terms under which readers can use gen.E and its content.",
      notice: "This is a layout placeholder, not a legal agreement. Replace every section below with reviewed text before launch.",
      seo: { title: "Terms", description: "gen.E terms of use." },
      layout: [
        {
          blockType: "sections",
          items: ["Using gen.E", "Our content", "Sharing and linking", "Third-party services", "Changes to these terms"].map((heading) => ({ heading, content: prose(LEGAL) })),
        },
      ],
    },
  ];
  for (const page of pages) {
    if (await findOne(payload, "pages", "slug", page.slug)) continue;
    await payload.create({ collection: "pages", data: { ...page, _status: "published" } as never, overrideAccess: true });
    log(`Page: /${page.slug}`);
  }

  log("Seed complete.");
}

await seed();
process.exit(0);
