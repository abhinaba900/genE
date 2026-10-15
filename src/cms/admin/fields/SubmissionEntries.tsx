"use client";

import { useField } from "@payloadcms/ui";

type Entry = { label: string; type?: string; value: string };

/** Shows a submission as labelled answers instead of raw JSON. */
export function SubmissionEntries() {
  const { value } = useField<Entry[] | null>({ path: "entries" });
  const entries = Array.isArray(value) ? value : [];

  if (entries.length === 0) return <p className="gene-help">No answers recorded.</p>;

  return (
    <dl className="gene-submission">
      {entries.map((e, i) => (
        <div key={i} className={e.type === "textarea" ? "gene-submission__row gene-submission__row--long" : "gene-submission__row"}>
          <dt>{e.label}</dt>
          <dd>
            {e.type === "email" && e.value ? (
              <a href={`mailto:${e.value}`}>{e.value}</a>
            ) : e.type === "tel" && e.value ? (
              <a href={`tel:${e.value.replace(/[^\d+]/g, "")}`}>{e.value}</a>
            ) : (
              e.value || "—"
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
