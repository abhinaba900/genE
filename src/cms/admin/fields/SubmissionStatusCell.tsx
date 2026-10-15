"use client";

const TONE: Record<string, { label: string; tone: string }> = {
  new: { label: "New", tone: "info" },
  read: { label: "Read", tone: "neutral" },
  replied: { label: "Replied", tone: "success" },
  spam: { label: "Spam", tone: "muted" },
};

/** Status pill in the form submissions list. */
export function SubmissionStatusCell({ cellData }: { cellData?: string | null }) {
  const meta = TONE[cellData ?? "new"] ?? TONE.new;
  return <span className={`gene-status gene-status--${meta.tone}`}>{meta.label}</span>;
}
