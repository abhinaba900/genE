"use client";

import { useDocumentInfo, useFormFields } from "@payloadcms/ui";
import { statusMeta } from "./status";

/** Editorial status, shown beside Save / Publish so it's never ambiguous what state a story is in. */
export function WorkflowBadge() {
  const { hasPublishedDoc, unpublishedVersionCount } = useDocumentInfo();
  const status = useFormFields(([fields]) => fields.workflowStatus?.value as string | undefined);
  const meta = statusMeta(status);
  const liveWithEdits = hasPublishedDoc && (unpublishedVersionCount ?? 0) > 0 && status !== "published";
  return (
    <span className="gene-badge-group">
      <span className={`gene-status gene-status--${meta.tone}`}>{meta.label}</span>
      {liveWithEdits && <span className="gene-status gene-status--success" title="An earlier version is live on the site">Live version online</span>}
    </span>
  );
}
