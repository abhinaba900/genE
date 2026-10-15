/**
 * Shared by the contact form block on the site (client-side checks) and the submission
 * endpoint (the real checks). Both validate against the same field definitions that
 * editors configure on the block, so the rules can't drift apart.
 */

export const FORM_FIELD_TYPES = [
  { label: "Short text", value: "text" },
  { label: "Email", value: "email" },
  { label: "Phone", value: "tel" },
  { label: "Long text", value: "textarea" },
  { label: "Dropdown", value: "select" },
  { label: "Checkbox", value: "checkbox" },
] as const;

export type FormFieldType = (typeof FORM_FIELD_TYPES)[number]["value"];

export interface FormFieldDef {
  label: string;
  type: FormFieldType;
  required?: boolean;
  placeholder?: string;
  /** Dropdown choices, one per line. */
  options?: string;
  width?: "half" | "full";
}

export type FormValues = Record<string, string | boolean>;
export type FormErrors = Record<string, string>;

/** Used when a block has no fields configured (e.g. one created before fields existed). */
export const DEFAULT_FORM_FIELDS: FormFieldDef[] = [
  { label: "Name", type: "text", required: true, width: "half" },
  { label: "Email", type: "email", required: true, width: "half" },
  { label: "Topic", type: "select", required: true, width: "full", options: "General enquiry\nStory tip\nPartnerships\nPress\nFeedback" },
  { label: "Message", type: "textarea", required: true, width: "full" },
];

export const MAX_LENGTH: Record<FormFieldType, number> = { text: 200, email: 254, tel: 20, textarea: 5000, select: 200, checkbox: 0 };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[\d\s()-]{6,20}$/;

/** Stable key for a field, derived from its label and position. */
export function fieldKey(field: Pick<FormFieldDef, "label">, index: number) {
  const slug = field.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${index}-${slug || "field"}`;
}

export function fieldOptions(field: Pick<FormFieldDef, "options">) {
  return (field.options ?? "")
    .split("\n")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function resolveFields(fields?: FormFieldDef[] | null) {
  return fields && fields.length > 0 ? fields : DEFAULT_FORM_FIELDS;
}

/** Returns an error message per invalid field key; an empty object means the values are valid. */
export function validateForm(fields: FormFieldDef[], values: FormValues): FormErrors {
  const errors: FormErrors = {};
  fields.forEach((field, i) => {
    const key = fieldKey(field, i);
    const raw = values[key];
    if (field.type === "checkbox") {
      if (field.required && raw !== true) errors[key] = "Please tick this box to continue.";
      return;
    }
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) {
      if (field.required) errors[key] = field.type === "select" ? "Please choose an option." : `Please enter your ${field.label.toLowerCase()}.`;
      return;
    }
    if (value.length > MAX_LENGTH[field.type]) errors[key] = `Please keep this under ${MAX_LENGTH[field.type]} characters.`;
    else if (field.type === "email" && !EMAIL.test(value)) errors[key] = "Please enter a valid email address.";
    else if (field.type === "tel" && !PHONE.test(value)) errors[key] = "Please enter a valid phone number.";
    else if (field.type === "select" && !fieldOptions(field).includes(value)) errors[key] = "Please choose one of the options.";
  });
  return errors;
}
