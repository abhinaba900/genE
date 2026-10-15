import type { Endpoint } from "payload";
import { publicStoryWhere } from "../access";
import { ANALYTICS_EVENTS, type AnalyticsEventType } from "../collections/AnalyticsEvents";

const SURFACES = ["feed", "article", "watch", "home", "category", "other"] as const;

// Small in-memory limiter: plenty for honest clients, stops a single tab flooding the table.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
const buckets = new Map<string, { count: number; reset: number }>();

function limited(key: string) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + WINDOW_MS });
    if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
    return false;
  }
  bucket.count++;
  return bucket.count > MAX_PER_WINDOW;
}

/**
 * POST /api/events  { type, story?, session, path?, surface? }
 *
 * Records first-party engagement events. Repeats are ignored by a unique index on
 * (type, story, session), so a looping reel counts one start and one completion.
 * Only published stories are accepted.
 */
export const analyticsEndpoint: Endpoint = {
  path: "/events",
  method: "post",
  handler: async (req) => {
    if (process.env.ANALYTICS_ENABLED === "false") return new Response(null, { status: 204 });
    const body = (await req.json?.().catch(() => null)) as Record<string, unknown> | null;
    const type = body?.type as AnalyticsEventType;
    const session = typeof body?.session === "string" ? body.session : "";
    if (!ANALYTICS_EVENTS.includes(type) || !/^[a-z0-9-]{8,64}$/i.test(session)) {
      return Response.json({ message: "Invalid event." }, { status: 400 });
    }
    if (limited(session)) return new Response(null, { status: 429 });

    const storyId = Number(body?.story) || undefined;
    let category: number | undefined;
    if (storyId) {
      const story = await req.payload
        .find({
          collection: "stories",
          where: { and: [{ id: { equals: storyId } }, publicStoryWhere()] },
          depth: 0,
          limit: 1,
          select: { category: true },
          overrideAccess: true,
        })
        .then((r) => r.docs[0])
        .catch(() => undefined);
      if (!story) return new Response(null, { status: 204 });
      category = typeof story.category === "object" ? story.category?.id : (story.category as number | undefined);
    }

    const surface = SURFACES.includes(body?.surface as never) ? (body?.surface as (typeof SURFACES)[number]) : "other";
    const path = typeof body?.path === "string" ? body.path.slice(0, 200).split("?")[0] : undefined;

    try {
      await req.payload.create({
        collection: "analytics-events",
        data: { type, story: storyId, category, session, path, surface },
        overrideAccess: true,
        disableTransaction: true,
      });
    } catch {
      // Duplicate (already counted for this session) — expected and fine.
    }
    return new Response(null, { status: 204 });
  },
};
