import "server-only";
import { headers } from "next/headers";
import type { Story as StoryDoc, Page as PageDoc, Homepage as HomepageDoc } from "@/payload-types";
import { missingForPublish } from "@/cms/workflow";
import type { ArticleBlock, Page, Story } from "../types";
import { lexicalToBlocks } from "./lexical";
import { toStory } from "./map";
import { buildFeed, homepage, payloadClient, toPage } from "./source";

/**
 * Draft previews for the CMS. Every call re-checks the signed-in CMS user from the
 * request cookies — there is no shareable preview token — and nothing here is cached.
 */
export async function previewUser() {
  const payload = await payloadClient();
  const { user } = await payload.auth({ headers: await headers() });
  return user && user.collection === "users" ? user : null;
}

export interface StoryPreview {
  story: Story | null;
  /** When the draft can't render as a full story yet (e.g. no video), its text is shown instead. */
  fallback?: { title: string; excerpt: string; body: ArticleBlock[]; missing: string[] };
  status?: string;
  live: boolean;
}

export async function getPreviewStory(id: string): Promise<StoryPreview> {
  const payload = await payloadClient();
  const doc = (await payload
    .findByID({ collection: "stories", id: Number(id), draft: true, depth: 2, overrideAccess: true })
    .catch(() => null)) as StoryDoc | null;
  if (!doc) return { story: null, live: false };
  const live = await payload.db.findOne({ collection: "stories", where: { id: { equals: Number(id) } } });
  const story = toStory({ ...doc, slug: doc.slug || `draft-${doc.id}`, title: doc.title || "Untitled story" });
  return {
    story,
    fallback: story
      ? undefined
      : { title: doc.title || "Untitled story", excerpt: doc.excerpt ?? "", body: lexicalToBlocks(doc.content), missing: missingForPublish(doc as never) },
    status: doc.workflowStatus ?? "draft",
    live: (live as { _status?: string } | null)?._status === "published",
  };
}

export async function getPreviewPage(id: string): Promise<Page | null> {
  const payload = await payloadClient();
  const doc = (await payload.findByID({ collection: "pages", id: Number(id), draft: true, depth: 2, overrideAccess: true }).catch(() => null)) as PageDoc | null;
  return doc ? toPage(doc) : null;
}

export async function getPreviewHomepage() {
  const payload = await payloadClient();
  const config = (await payload.findGlobal({ slug: "homepage", draft: true, depth: 0, overrideAccess: true })) as HomepageDoc;
  const [home, feed] = await Promise.all([homepage(config), buildFeed(config)]);
  return { home, feed };
}
