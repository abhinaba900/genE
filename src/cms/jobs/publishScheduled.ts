import type { PayloadRequest, TaskConfig } from "payload";
import { recordAudit } from "../audit";
import { TAGS, revalidate } from "../revalidate";
import { missingForPublish } from "../workflow";

/**
 * Publishes stories whose scheduled time has passed. Queued every minute by the job
 * scheduler and executed by either:
 *   - the in-process runner (`jobs.autoRun`, long-running Node servers), or
 *   - an external cron calling GET /api/payload-jobs/run (serverless; see README).
 * Safe to run concurrently or repeatedly: a story is published once, then leaves the query.
 */
export const publishScheduledTask: TaskConfig<{ input: Record<string, never>; output: { published: number; failed: number } }> = {
  slug: "publishScheduledStories",
  label: "Publish scheduled stories",
  schedule: [{ cron: "* * * * *", queue: "editorial" }],
  retries: 2,
  inputSchema: [],
  outputSchema: [
    { name: "published", type: "number", required: true },
    { name: "failed", type: "number", required: true },
  ],
  handler: async ({ req }) => {
    const result = await publishDueStories(req);
    return { output: result };
  },
};

export async function publishDueStories(req: PayloadRequest, now = new Date()) {
  const { payload } = req;
  const due = await payload.find({
    collection: "stories",
    where: { and: [{ workflowStatus: { equals: "scheduled" } }, { scheduledFor: { less_than_equal: now.toISOString() } }] },
    draft: true,
    depth: 0,
    limit: 50,
    overrideAccess: true,
    req,
  });

  let published = 0;
  let failed = 0;
  for (const story of due.docs) {
    const missing = missingForPublish(story as never);
    if (missing.length) {
      failed++;
      await payload.db.updateOne({ collection: "stories", id: story.id, data: { workflowStatus: "changes_requested", scheduledFor: null, reviewNote: `Scheduled publish failed: missing ${missing.join(", ")}.` }, req });
      await recordAudit(req, { action: "changes_requested", collection: "stories", docId: story.id, title: story.title, note: `Scheduled publish skipped — missing ${missing.join(", ")}` });
      continue;
    }
    try {
      req.context.systemPublish = true;
      // Publishes the latest draft (Payload merges partial updates into the newest version).
      await payload.update({
        collection: "stories",
        id: story.id,
        data: { _status: "published", publishedAt: story.publishedAt ?? story.scheduledFor ?? now.toISOString() },
        overrideAccess: true,
        req,
      });
      published++;
    } catch (err) {
      failed++;
      payload.logger.error({ err, msg: `Scheduled publish failed for story ${story.id}` });
    } finally {
      req.context.systemPublish = false;
    }
  }
  if (published) revalidate(TAGS.stories);
  return { published, failed };
}
