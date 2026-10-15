export const STATUS_META: Record<string, { label: string; tone: "neutral" | "info" | "warning" | "success" | "accent" | "muted" }> = {
  draft: { label: "Draft", tone: "neutral" },
  in_review: { label: "In review", tone: "info" },
  changes_requested: { label: "Changes requested", tone: "warning" },
  approved: { label: "Approved", tone: "info" },
  scheduled: { label: "Scheduled", tone: "accent" },
  published: { label: "Published", tone: "success" },
  archived: { label: "Archived", tone: "muted" },
};

export function statusMeta(status?: string | null) {
  return STATUS_META[status ?? "draft"] ?? STATUS_META.draft;
}

/**
 * "Drafts" = everything not finished: new drafts, stories sent back for changes, and live
 * stories with edits that haven't been republished (Payload `_status: "draft"`).
 */
export const DRAFTS_WHERE = {
  or: [{ workflowStatus: { in: ["draft", "changes_requested"] } }, { _status: { equals: "draft" } }],
};
export const DRAFTS_QUERY = "where[or][0][workflowStatus][in]=draft,changes_requested&where[or][1][_status][equals]=draft";
