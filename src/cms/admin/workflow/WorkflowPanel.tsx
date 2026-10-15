"use client";

import { toast, useAuth, useConfig, useDocumentInfo, useFormFields, useFormModified } from "@payloadcms/ui";
import { CalendarClock, Check, Eye, Send, Undo2, X, Archive, RotateCcw, MessageSquareWarning } from "lucide-react";
import { useState } from "react";
import { DEFAULT_TIMEZONE, formatInZone, utcToZonedLocal, zoneLabel, zonedLocalToUtc } from "../../time";
import { statusMeta } from "./status";

type Action = "submit" | "withdraw" | "request_changes" | "approve" | "schedule" | "cancel_schedule" | "archive" | "restore";

/**
 * Sidebar panel driving the editorial workflow:
 *   Author: write → Submit for review
 *   Editor: Approve / Request changes → Publish now (Payload's Publish button) or Schedule
 * Every action is re-checked on the server (POST /api/stories/:id/workflow).
 */
export function WorkflowPanel() {
  const { id, hasPublishedDoc } = useDocumentInfo();
  const { user } = useAuth<{ id: number; role?: string }>();
  const { config } = useConfig();
  const modified = useFormModified();
  const timeZone = config.admin?.timezones?.defaultTimezone ?? DEFAULT_TIMEZONE;

  const status = useFormFields(([f]) => f.workflowStatus?.value as string | undefined) ?? "draft";
  const scheduledFor = useFormFields(([f]) => f.scheduledFor?.value as string | undefined);
  const publishedAt = useFormFields(([f]) => f.publishedAt?.value as string | undefined);
  const reviewNote = useFormFields(([f]) => f.reviewNote?.value as string | undefined);
  const createdBy = useFormFields(([f]) => f.createdBy?.value as number | { id: number } | undefined);

  const [busy, setBusy] = useState<Action | null>(null);
  const [mode, setMode] = useState<"idle" | "schedule" | "changes">("idle");
  const [when, setWhen] = useState(() => utcToZonedLocal(new Date(Date.now() + 60 * 60 * 1000), timeZone));
  const [note, setNote] = useState("");

  const role = user?.role ?? "author";
  const isEditor = role === "admin" || role === "editor";
  const ownerId = typeof createdBy === "object" ? createdBy?.id : createdBy;
  const isOwner = !ownerId || String(ownerId) === String(user?.id);
  const meta = statusMeta(status);

  if (!id) {
    return (
      <div className="gene-workflow">
        <p className="gene-workflow__label">Status</p>
        <span className={`gene-status gene-status--${meta.tone}`}>New story</span>
        <p className="gene-workflow__hint">Start with a headline. Your work saves automatically as a draft — nothing goes live until an editor publishes it.</p>
      </div>
    );
  }

  async function run(action: Action, extra: Record<string, unknown> = {}) {
    if (modified) {
      toast.info("Saving your latest changes — try again in a moment.");
      return;
    }
    setBusy(action);
    try {
      const res = await fetch(`${config.serverURL}${config.routes.api}/stories/${id}/workflow`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message ?? "Something went wrong.");
      toast.success(SUCCESS[action]);
      // Reload so the form reflects the server's new state.
      setTimeout(() => window.location.reload(), 400);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(null);
    }
  }

  function submitSchedule() {
    const date = zonedLocalToUtc(when, timeZone);
    if (!date) return toast.error("Choose a date and time.");
    if (date.getTime() < Date.now() + 60_000) return toast.error("Choose a time at least a minute from now.");
    run("schedule", { scheduledFor: date.toISOString() });
  }

  const previewHref = `/preview/stories/${id}`;

  return (
    <div className="gene-workflow">
      <p className="gene-workflow__label">Editorial status</p>
      <span className={`gene-status gene-status--lg gene-status--${meta.tone}`}>{meta.label}</span>

      <p className="gene-workflow__hint">
        {status === "draft" && (isEditor ? "Not on the site. Publish when it's ready, or schedule it." : "Saved as a draft. Submit it for review when it's ready.")}
        {status === "in_review" && (isEditor ? "Waiting for your review." : "With the editors. You can keep editing; they'll see the latest version.")}
        {status === "changes_requested" && "An editor asked for changes. Make them, then submit again."}
        {status === "approved" && (isEditor ? "Approved. Publish now or schedule it." : "Approved by an editor. It'll be published soon.")}
        {status === "scheduled" && scheduledFor && <>Goes live {formatInZone(scheduledFor, timeZone)}.</>}
        {status === "published" && publishedAt && <>Live on gen.E since {formatInZone(publishedAt, timeZone)}.</>}
        {status === "archived" && "Archived: off the site and out of feeds."}
      </p>

      {reviewNote && ["changes_requested", "in_review"].includes(status) && (
        <div className="gene-workflow__note">
          <MessageSquareWarning size={14} aria-hidden />
          <span>{reviewNote}</span>
        </div>
      )}

      <div className="gene-workflow__actions">
        <a className="gene-btn gene-btn--ghost" href={previewHref} target="_blank" rel="noopener">
          <Eye size={15} aria-hidden /> Preview
        </a>

        {(isOwner || isEditor) && ["draft", "changes_requested"].includes(status) && (
          <button type="button" className="gene-btn gene-btn--primary" disabled={!!busy} onClick={() => run("submit")}>
            <Send size={15} aria-hidden /> {busy === "submit" ? "Submitting…" : "Submit for review"}
          </button>
        )}
        {(isOwner || isEditor) && status === "in_review" && !isEditor && (
          <button type="button" className="gene-btn" disabled={!!busy} onClick={() => run("withdraw")}>
            <Undo2 size={15} aria-hidden /> Withdraw
          </button>
        )}

        {isEditor && ["in_review", "changes_requested"].includes(status) && (
          <button type="button" className="gene-btn gene-btn--primary" disabled={!!busy} onClick={() => run("approve")}>
            <Check size={15} aria-hidden /> Approve
          </button>
        )}
        {isEditor && ["in_review", "approved", "scheduled"].includes(status) && (
          <button type="button" className="gene-btn" disabled={!!busy} onClick={() => setMode(mode === "changes" ? "idle" : "changes")}>
            <MessageSquareWarning size={15} aria-hidden /> Request changes
          </button>
        )}
        {isEditor && status !== "archived" && (
          <button type="button" className="gene-btn" disabled={!!busy} onClick={() => setMode(mode === "schedule" ? "idle" : "schedule")}>
            <CalendarClock size={15} aria-hidden /> {status === "scheduled" ? "Reschedule" : "Schedule"}
          </button>
        )}
        {isEditor && status === "scheduled" && (
          <button type="button" className="gene-btn" disabled={!!busy} onClick={() => run("cancel_schedule")}>
            <X size={15} aria-hidden /> Cancel schedule
          </button>
        )}
        {isEditor && (status === "published" || hasPublishedDoc) && status !== "archived" && (
          <button
            type="button"
            className="gene-btn gene-btn--danger"
            disabled={!!busy}
            onClick={() => window.confirm("Archive this story? It will be removed from the site and all feeds.") && run("archive")}
          >
            <Archive size={15} aria-hidden /> Archive
          </button>
        )}
        {isEditor && status === "archived" && (
          <button type="button" className="gene-btn" disabled={!!busy} onClick={() => run("restore")}>
            <RotateCcw size={15} aria-hidden /> Restore to drafts
          </button>
        )}
      </div>

      {mode === "schedule" && (
        <div className="gene-workflow__form">
          <label htmlFor="gene-schedule">Publish at</label>
          <input id="gene-schedule" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          <p className="gene-workflow__hint">Time zone: {zoneLabel(timeZone)}</p>
          <button type="button" className="gene-btn gene-btn--primary" disabled={!!busy} onClick={submitSchedule}>
            {busy === "schedule" ? "Scheduling…" : "Confirm schedule"}
          </button>
        </div>
      )}
      {mode === "changes" && (
        <div className="gene-workflow__form">
          <label htmlFor="gene-changes">What needs to change?</label>
          <textarea id="gene-changes" rows={4} value={note} onChange={(e) => setNote(e.target.value)} />
          <button type="button" className="gene-btn gene-btn--primary" disabled={!!busy || !note.trim()} onClick={() => run("request_changes", { note })}>
            Send to author
          </button>
        </div>
      )}

      {isEditor && status !== "published" && status !== "archived" && (
        <p className="gene-workflow__hint gene-workflow__hint--small">To go live now, use <strong>Publish changes</strong> at the top.</p>
      )}
      {!isEditor && <p className="gene-workflow__hint gene-workflow__hint--small">Only editors can publish.</p>}
    </div>
  );
}

const SUCCESS: Record<Action, string> = {
  submit: "Submitted for review.",
  withdraw: "Withdrawn from review.",
  request_changes: "Changes requested.",
  approve: "Approved.",
  schedule: "Scheduled.",
  cancel_schedule: "Schedule cancelled.",
  archive: "Archived and removed from the site.",
  restore: "Restored to drafts.",
};
