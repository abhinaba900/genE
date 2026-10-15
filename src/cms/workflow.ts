import type { Endpoint, PayloadRequest } from "payload";
import type { Story as Stories } from "../payload-types";
import { hasRole, staffUser } from "./access";
import { type AuditAction, recordAudit } from "./audit";
import { TAGS, revalidate } from "./revalidate";

export const WORKFLOW_ACTIONS = ["submit", "withdraw", "request_changes", "approve", "schedule", "cancel_schedule", "archive", "restore"] as const;
export type WorkflowAction = (typeof WORKFLOW_ACTIONS)[number];

type Story = {
  id: number;
  title?: string;
  workflowStatus?: string;
  _status?: "draft" | "published";
  createdBy?: number | { id: number } | null;
  video?: unknown;
  content?: { root?: { children?: unknown[] } } | null;
  category?: unknown;
  author?: unknown;
  excerpt?: string | null;
};

/** What must be in place before a story can go live (also enforced by `required` on publish). */
export function missingForPublish(story: Story): string[] {
  const missing: string[] = [];
  if (!story.title?.trim()) missing.push("headline");
  if (!story.excerpt?.trim()) missing.push("summary");
  if (!story.category) missing.push("primary category");
  if (!story.author) missing.push("author");
  if (!story.video) missing.push("video");
  const hasText = JSON.stringify(story.content?.root?.children ?? []).includes('"text":"');
  if (!hasText) missing.push("article text");
  return missing;
}

const ownerId = (s: Story) => (typeof s.createdBy === "object" ? s.createdBy?.id : s.createdBy);

/**
 * POST /api/stories/:id/workflow  { action, note?, scheduledFor? }
 *
 * Editorial transitions that are not plain saves. Each one is checked against the
 * caller's role here on the server. Publishing and unpublishing themselves use Payload's
 * own Publish / Unpublish actions, which `storyUpdate` access already guards.
 */
export const workflowEndpoint: Endpoint = {
  path: "/:id/workflow",
  method: "post",
  handler: async (req) => {
    const user = staffUser(req);
    if (!user) return Response.json({ message: "Sign in to continue." }, { status: 401 });

    const id = Number(req.routeParams?.id);
    const body = ((await req.json?.()) ?? {}) as { action?: WorkflowAction; note?: string; scheduledFor?: string };
    const action = body.action;
    if (!id || !action || !WORKFLOW_ACTIONS.includes(action)) {
      return Response.json({ message: "Unknown workflow action." }, { status: 400 });
    }

    // Latest version (draft or published) — what the editor is looking at.
    const story = (await req.payload
      .findByID({ collection: "stories", id, draft: true, depth: 0, overrideAccess: true, req })
      .catch(() => null)) as Story | null;
    if (!story) return Response.json({ message: "Story not found." }, { status: 404 });
    // The live row decides what the public sees; the latest version may be a newer draft.
    const live = (await req.payload.db.findOne({ collection: "stories", where: { id: { equals: id } }, req })) as Story | null;
    const isLive = live?._status === "published";

    const isEditor = hasRole(req, "admin", "editor");
    const isOwner = String(ownerId(story)) === String(user.id);
    const status = story.workflowStatus ?? "draft";
    const deny = (message: string, code = 403) => Response.json({ message }, { status: code });

    let next: string;
    let audit: AuditAction;
    const extra: Record<string, unknown> = {};

    switch (action) {
      case "submit":
        if (!isEditor && !isOwner) return deny("You can only submit your own stories.");
        if (!["draft", "changes_requested"].includes(status)) return deny("Only drafts can be submitted for review.", 409);
        {
          const missing = missingForPublish(story);
          if (missing.length) return deny(`Add the ${missing.join(", ")} before submitting.`, 422);
        }
        next = "in_review";
        audit = "submitted";
        if (body.note !== undefined) extra.reviewNote = body.note;
        break;
      case "withdraw":
        if (!isEditor && !isOwner) return deny("You can only withdraw your own stories.");
        if (status !== "in_review") return deny("Only stories in review can be withdrawn.", 409);
        next = "draft";
        audit = "updated";
        break;
      case "request_changes":
        if (!isEditor) return deny("Only editors can request changes.");
        if (!["in_review", "approved", "scheduled"].includes(status)) return deny("This story isn't awaiting review.", 409);
        if (!body.note?.trim()) return deny("Say what needs to change.", 422);
        next = "changes_requested";
        audit = "changes_requested";
        extra.reviewNote = body.note.trim();
        extra.scheduledFor = null;
        break;
      case "approve":
        if (!isEditor) return deny("Only editors can approve stories.");
        if (!["in_review", "changes_requested", "draft"].includes(status)) return deny("This story can't be approved from its current state.", 409);
        next = "approved";
        audit = "approved";
        break;
      case "schedule": {
        if (!isEditor) return deny("Only editors can schedule publication.");
        if (status === "archived") return deny("Restore the story before scheduling it.", 409);
        const when = body.scheduledFor ? new Date(body.scheduledFor) : null;
        if (!when || Number.isNaN(when.getTime())) return deny("Choose a valid date and time.", 422);
        if (when.getTime() < Date.now() + 60_000) return deny("Choose a time at least one minute from now.", 422);
        if (when.getTime() > Date.now() + 366 * 24 * 3600_000) return deny("Schedules can be at most a year ahead.", 422);
        const missing = missingForPublish(story);
        if (missing.length) return deny(`Add the ${missing.join(", ")} before scheduling.`, 422);
        next = "scheduled";
        audit = "scheduled";
        extra.scheduledFor = when.toISOString();
        // A first publication takes the scheduled time as its date; a scheduled update to a live story keeps its original date.
        if (!isLive) extra.publishedAt = when.toISOString();
        break;
      }
      case "cancel_schedule":
        if (!isEditor) return deny("Only editors can change schedules.");
        if (status !== "scheduled") return deny("This story isn't scheduled.", 409);
        next = "approved";
        audit = "schedule_cancelled";
        extra.scheduledFor = null;
        break;
      case "archive":
        if (!isEditor) return deny("Only editors can archive stories.");
        if (status === "archived") return deny("Already archived.", 409);
        next = "archived";
        audit = "archived";
        extra.scheduledFor = null;
        break;
      case "restore":
        if (!isEditor) return deny("Only editors can restore stories.");
        if (status !== "archived") return deny("Only archived stories can be restored.", 409);
        next = "draft";
        audit = "restored";
        break;
    }

    await applyWorkflow(req, story, isLive, next, extra);
    await recordAudit(req, {
      action: audit,
      collection: "stories",
      docId: id,
      title: story.title,
      note: action === "schedule" ? `For ${extra.scheduledFor}` : body.note,
    });
    return Response.json({ status: next, message: "Updated." });
  },
};

/**
 * Write the new editorial state without publishing anything.
 *  - Archiving a live story also takes it off the site (unpublish).
 *  - Otherwise the change is saved onto the latest draft, so unpublished edits are kept,
 *    and mirrored onto the live record so lists and the public filter agree.
 */
async function applyWorkflow(req: PayloadRequest, story: Story, isLive: boolean, next: string, extra: Record<string, unknown>) {
  req.context.workflowAction = true;
  req.context.workflowTarget = next;

  if (next === "archived" && isLive) {
    await req.payload.update({
      collection: "stories",
      id: story.id,
      data: { _status: "draft", workflowStatus: "archived", ...extra },
      overrideAccess: true,
      req,
    });
    return;
  }

  await req.payload.update({
    collection: "stories",
    id: story.id,
    data: { workflowStatus: next as Stories["workflowStatus"], ...extra },
    draft: true,
    overrideAccess: true,
    req,
  });
  // The live row keeps its content; only the editorial fields are synced.
  await req.payload.db.updateOne({
    collection: "stories",
    id: story.id,
    data: { workflowStatus: next === "archived" ? "archived" : isLive ? "published" : next, ...pick(extra, ["scheduledFor", "reviewNote"]) },
    req,
  });
  revalidate(TAGS.stories);
}

function pick(source: Record<string, unknown>, keys: string[]) {
  return Object.fromEntries(keys.filter((k) => k in source).map((k) => [k, source[k]]));
}
