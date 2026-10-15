"use client";

import { useRowLabel } from "@payloadcms/ui";
import { FORM_FIELD_TYPES, type FormFieldDef } from "@/lib/forms";

/** "Email · required" style labels for the contact form block's field rows. */
export function FormFieldRowLabel() {
  const { data, rowNumber } = useRowLabel<Partial<FormFieldDef>>();
  const type = FORM_FIELD_TYPES.find((t) => t.value === data?.type)?.label;
  return (
    <span className="gene-row-label">
      <strong>{data?.label || `Field ${(rowNumber ?? 0) + 1}`}</strong>
      {type && <small>{type}{data?.required ? " · required" : ""}</small>}
    </span>
  );
}
