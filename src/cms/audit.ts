import type { PayloadRequest } from "payload";
import { staffUser } from "./access";

export const AUDIT_ACTIONS = [
  "created",
  "updated",
  "submitted",
  "changes_requested",
  "approved",
  "scheduled",
  "schedule_cancelled",
  "published",
  "unpublished",
  "archived",
  "restored",
  "trashed",
  "deleted",
  "merged",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * Append an entry to the editorial activity log. Uses the caller's `req` so the entry
 * commits (or rolls back) in the same transaction as the change it describes.
 * Logging must never break an editorial action, so failures are reported and swallowed.
 */
export async function recordAudit(
  req: PayloadRequest,
  entry: { action: AuditAction; collection: string; docId: number | string; title?: string | null; note?: string },
) {
  try {
    const user = staffUser(req);
    await req.payload.create({
      collection: "audit-events",
      data: {
        action: entry.action,
        entityCollection: entry.collection,
        entityId: String(entry.docId),
        entityTitle: entry.title?.slice(0, 300) ?? "",
        note: entry.note?.slice(0, 1000),
        user: user ? Number(user.id) : undefined,
        system: !user,
      },
      overrideAccess: true,
      req,
    });
  } catch (err) {
    req.payload.logger.error({ err, msg: `Could not record audit event ${entry.action} for ${entry.collection}/${entry.docId}` });
  }
}
