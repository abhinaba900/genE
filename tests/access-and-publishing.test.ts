import { beforeAll, describe, expect, it } from "vitest";
import { publicStoryWhere } from "@/cms/access";
import { publishDueStories } from "@/cms/jobs/publishScheduled";
import { workflowEndpoint } from "@/cms/workflow";
import { articleContent, asUser, callEndpoint, setup, uniqueSlug } from "./helpers";

type Ctx = Awaited<ReturnType<typeof setup>>;
let ctx: Ctx;

beforeAll(async () => {
  ctx = await setup();
});

/** A complete draft story created by `user` through access control (overrideAccess: false). */
async function draftStory(user: Ctx["author"], overrides: Record<string, unknown> = {}) {
  const { payload, category, byline, video } = ctx;
  return payload.create({
    collection: "stories",
    data: {
      title: "Test story",
      slug: uniqueSlug(),
      excerpt: "A summary.",
      category: category.id,
      author: byline.id,
      video: video.id,
      content: articleContent() as never,
      ...overrides,
    },
    draft: true,
    user,
    overrideAccess: false,
  });
}

async function publiclyVisible(slug: string) {
  // Same query the public site uses, run as an anonymous visitor.
  const res = await ctx.payload.find({ collection: "stories", where: { and: [publicStoryWhere(), { slug: { equals: slug } }] }, overrideAccess: false });
  return res.docs.length === 1;
}

async function publish(id: number, user: Ctx["editor"]) {
  return ctx.payload.update({ collection: "stories", id, data: { _status: "published" }, user, overrideAccess: false });
}

describe("authors", () => {
  it("can create a draft, which is not public", async () => {
    const story = await draftStory(ctx.author);
    expect(story.workflowStatus).toBe("draft");
    expect(story.createdBy).toBeTruthy();
    expect(await publiclyVisible(story.slug!)).toBe(false);
  });

  it("cannot publish their own story", async () => {
    const story = await draftStory(ctx.author);
    await expect(publish(story.id, ctx.author)).rejects.toThrow();
    expect(await publiclyVisible(story.slug!)).toBe(false);
  });

  it("cannot create a story directly as published", async () => {
    const { payload, category, byline, video } = ctx;
    const slug = uniqueSlug();
    await expect(
      payload.create({
        collection: "stories",
        data: { title: "Sneaky", slug, excerpt: "x", category: category.id, author: byline.id, video: video.id, content: articleContent() as never, _status: "published" },
        user: ctx.author,
        overrideAccess: false,
      }),
    ).rejects.toThrow(/Only editors can publish/);
    expect(await publiclyVisible(slug)).toBe(false);
  });

  it("cannot edit another author's story", async () => {
    const story = await draftStory(ctx.author);
    await expect(
      ctx.payload.update({ collection: "stories", id: story.id, data: { title: "Hijacked" }, draft: true, user: ctx.author2, overrideAccess: false }),
    ).rejects.toThrow();
  });

  it("cannot set the editorial status or featured flag themselves", async () => {
    const story = await draftStory(ctx.author);
    const updated = await ctx.payload.update({
      collection: "stories",
      id: story.id,
      data: { workflowStatus: "approved", featured: true },
      draft: true,
      user: ctx.author,
      overrideAccess: false,
    });
    expect(updated.workflowStatus).toBe("draft");
    expect(updated.featured).toBe(false);
  });

  it("can submit for review but cannot approve or schedule", async () => {
    const story = await draftStory(ctx.author);
    const submit = await callEndpoint(ctx.payload, workflowEndpoint.handler, ctx.author, { id: String(story.id) }, { action: "submit" });
    expect(submit.status).toBe(200);
    const approve = await callEndpoint(ctx.payload, workflowEndpoint.handler, ctx.author, { id: String(story.id) }, { action: "approve" });
    expect(approve.status).toBe(403);
    const schedule = await callEndpoint(ctx.payload, workflowEndpoint.handler, ctx.author, { id: String(story.id) }, {
      action: "schedule",
      scheduledFor: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(schedule.status).toBe(403);
  });

  it("cannot change their own role or create team members", async () => {
    await expect(
      ctx.payload.update({ collection: "users", id: ctx.author.id, data: { role: "admin" }, user: ctx.author, overrideAccess: false }),
    ).resolves.toMatchObject({ role: "author" });
    await expect(
      ctx.payload.create({ collection: "users", data: { email: "x@test.local", password: "test-Password-1", name: "X", role: "admin" }, user: ctx.author, overrideAccess: false }),
    ).rejects.toThrow();
  });
});

describe("editors and the public site", () => {
  it("publishing makes a story public; drafts on top of it stay private", async () => {
    const story = await draftStory(ctx.author);
    const published = await publish(story.id, ctx.editor);
    expect(published.workflowStatus).toBe("published");
    expect(published.publishedAt).toBeTruthy();
    expect(await publiclyVisible(story.slug!)).toBe(true);

    // Saving a new draft must not change the live version.
    await ctx.payload.update({ collection: "stories", id: story.id, data: { title: "Unreleased headline" }, draft: true, user: ctx.editor, overrideAccess: false });
    const live = await ctx.payload.findByID({ collection: "stories", id: story.id, overrideAccess: false });
    expect(live.title).toBe("Test story");

    // Republishing applies the draft.
    await publish(story.id, ctx.editor);
    const updated = await ctx.payload.findByID({ collection: "stories", id: story.id, overrideAccess: false });
    expect(updated.title).toBe("Unreleased headline");
  });

  it("unpublishing removes the story from public queries and direct reads", async () => {
    const story = await draftStory(ctx.author);
    await publish(story.id, ctx.editor);
    await ctx.payload.update({ collection: "stories", id: story.id, data: { _status: "draft" }, user: ctx.editor, overrideAccess: false });
    expect(await publiclyVisible(story.slug!)).toBe(false);
    await expect(ctx.payload.findByID({ collection: "stories", id: story.id, overrideAccess: false })).rejects.toThrow();
  });

  it("archiving takes a live story off the site", async () => {
    const story = await draftStory(ctx.author);
    await publish(story.id, ctx.editor);
    const res = await callEndpoint(ctx.payload, workflowEndpoint.handler, ctx.editor, { id: String(story.id) }, { action: "archive" });
    expect(res.status).toBe(200);
    expect(await publiclyVisible(story.slug!)).toBe(false);
  });

  it("refuses to publish an incomplete story", async () => {
    const story = await draftStory(ctx.author, { video: null });
    await expect(publish(story.id, ctx.editor)).rejects.toThrow();
  });

  it("refuses 'publish now' with a future date (that's what scheduling is for)", async () => {
    const story = await draftStory(ctx.author, { publishedAt: new Date(Date.now() + 86_400_000).toISOString() });
    await expect(publish(story.id, ctx.editor)).rejects.toThrow(/Schedule/);
  });

  it("anonymous visitors cannot read activity or analytics", async () => {
    await expect(ctx.payload.find({ collection: "audit-events", overrideAccess: false })).rejects.toThrow();
    await expect(ctx.payload.find({ collection: "analytics-events", overrideAccess: false })).rejects.toThrow();
  });

  it("records an audit trail for publishing", async () => {
    const story = await draftStory(ctx.author);
    await publish(story.id, ctx.editor);
    const events = await ctx.payload.find({
      collection: "audit-events",
      where: { and: [{ entityId: { equals: String(story.id) } }, { action: { equals: "published" } }] },
      overrideAccess: true,
    });
    expect(events.totalDocs).toBe(1);
  });
});

describe("scheduled publishing", () => {
  it("publishes due stories and leaves future ones alone", async () => {
    const due = await draftStory(ctx.author);
    const later = await draftStory(ctx.author);
    for (const [story, when] of [
      [due, Date.now() + 2 * 60_000],
      [later, Date.now() + 2 * 3600_000],
    ] as const) {
      const res = await callEndpoint(ctx.payload, workflowEndpoint.handler, ctx.editor, { id: String(story.id) }, {
        action: "schedule",
        scheduledFor: new Date(when).toISOString(),
      });
      expect(res.status).toBe(200);
    }
    expect(await publiclyVisible(due.slug!)).toBe(false);

    // Run the job as if 5 minutes had passed.
    const req = await asUser(ctx.payload, null);
    const result = await publishDueStories(req, new Date(Date.now() + 5 * 60_000));
    expect(result.published).toBeGreaterThanOrEqual(1);

    const dueNow = await ctx.payload.findByID({ collection: "stories", id: due.id, overrideAccess: true });
    expect(dueNow._status).toBe("published");
    expect(dueNow.workflowStatus).toBe("published");
    const laterNow = await ctx.payload.findByID({ collection: "stories", id: later.id, overrideAccess: true, draft: true });
    expect(laterNow.workflowStatus).toBe("scheduled");
    expect(await publiclyVisible(later.slug!)).toBe(false);
  });

  it("rejects schedules in the past", async () => {
    const story = await draftStory(ctx.author);
    const res = await callEndpoint(ctx.payload, workflowEndpoint.handler, ctx.editor, { id: String(story.id) }, {
      action: "schedule",
      scheduledFor: new Date(Date.now() - 60_000).toISOString(),
    });
    expect(res.status).toBe(422);
  });

  it("cancelling a schedule keeps the story unpublished", async () => {
    const story = await draftStory(ctx.author);
    await callEndpoint(ctx.payload, workflowEndpoint.handler, ctx.editor, { id: String(story.id) }, {
      action: "schedule",
      scheduledFor: new Date(Date.now() + 2 * 60_000).toISOString(),
    });
    const cancel = await callEndpoint(ctx.payload, workflowEndpoint.handler, ctx.editor, { id: String(story.id) }, { action: "cancel_schedule" });
    expect(cancel.status).toBe(200);
    const req = await asUser(ctx.payload, null);
    await publishDueStories(req, new Date(Date.now() + 10 * 60_000));
    expect(await publiclyVisible(story.slug!)).toBe(false);
  });
});

describe("referential safety", () => {
  it("won't delete a category that stories use", async () => {
    await draftStory(ctx.author);
    await expect(ctx.payload.delete({ collection: "categories", id: ctx.category.id, user: ctx.editor, overrideAccess: false })).rejects.toThrow(/in use/);
  });

  it("won't delete a video a story uses", async () => {
    await expect(ctx.payload.delete({ collection: "videos", id: ctx.video.id, user: ctx.editor, overrideAccess: false })).rejects.toThrow(/in use/);
  });

  it("keeps old slugs so renamed stories can redirect", async () => {
    const story = await draftStory(ctx.author);
    const oldSlug = story.slug!;
    await publish(story.id, ctx.editor);
    const renamed = await ctx.payload.update({
      collection: "stories",
      id: story.id,
      data: { slug: uniqueSlug("renamed"), _status: "published" },
      user: ctx.editor,
      overrideAccess: false,
    });
    expect(renamed.previousSlugs).toContain(oldSlug);
  });
});
