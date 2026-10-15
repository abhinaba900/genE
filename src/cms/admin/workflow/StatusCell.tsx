"use client";

import { statusMeta } from "./status";

/** Status pill in the stories list. */
export function StatusCell({ cellData }: { cellData?: string | null }) {
  const meta = statusMeta(cellData);
  return <span className={`gene-status gene-status--${meta.tone}`}>{meta.label}</span>;
}
