"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { fieldKey, fieldOptions, MAX_LENGTH, validateForm, type FormErrors, type FormFieldDef, type FormValues } from "@/lib/forms";

type Props = {
  pageId: string;
  blockId: string;
  heading?: string;
  intro?: string;
  submitLabel?: string;
  successMessage?: string;
  fields: FormFieldDef[];
};

const AUTOCOMPLETE: Partial<Record<FormFieldDef["type"], string>> = { email: "email", tel: "tel" };

const emptyValues = (fields: FormFieldDef[]): FormValues =>
  Object.fromEntries(fields.map((f, i) => [fieldKey(f, i), f.type === "checkbox" ? false : ""]));

/**
 * Contact form built from the fields an editor configures on the page block. Checks input
 * as the visitor types, then sends it to `/api/form-submissions/submit`, which validates
 * again with the same rules and stores it in the CMS.
 */
export function ContactForm({ pageId, blockId, heading, intro, submitLabel, successMessage, fields }: Props) {
  const [values, setValues] = useState<FormValues>(() => emptyValues(fields));
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [honeypot, setHoneypot] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [formError, setFormError] = useState<string | null>(null);
  const [sentMessage, setSentMessage] = useState<string | undefined>(successMessage);
  const prefix = `contact-${blockId}`;

  const setValue = (key: string, value: string | boolean) => {
    const next = { ...values, [key]: value };
    setValues(next);
    if (touched[key]) setErrors(validateForm(fields, next));
  };
  const blur = (key: string) => () => {
    setTouched((t) => ({ ...t, [key]: true }));
    setErrors(validateForm(fields, values));
  };

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError(null);
    const found = validateForm(fields, values);
    setErrors(found);
    setTouched(Object.fromEntries(fields.map((f, i) => [fieldKey(f, i), true])));
    const firstInvalid = Object.keys(found)[0];
    if (firstInvalid) {
      document.getElementById(`${prefix}-${firstInvalid}`)?.focus();
      return;
    }

    setState("sending");
    try {
      const res = await fetch("/api/form-submissions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ page: pageId, block: blockId, values, website: honeypot }),
      });
      const body = (await res.json().catch(() => ({}))) as { message?: string; errors?: FormErrors };
      if (!res.ok) {
        if (body.errors) setErrors(body.errors);
        throw new Error(body.message ?? "Something went wrong. Please try again.");
      }
      setSentMessage(body.message ?? successMessage);
      setState("sent");
    } catch (err) {
      setFormError((err as Error).message);
      setState("idle");
    }
  }

  if (state === "sent") {
    return (
      <div role="status" className="animate-rise rounded-2xl bg-paper-2 p-8">
        <span className="flex size-12 items-center justify-center rounded-full bg-ink text-white">
          <Check className="size-5" aria-hidden />
        </span>
        <h2 className="mt-6 font-serif text-[30px] leading-tight text-ink">Message sent.</h2>
        <p className="mt-3 max-w-md text-[15px] leading-relaxed text-ink/70">
          {sentMessage ?? "Thanks — your message has reached the gen.E team."}
        </p>
        <button
          type="button"
          onClick={() => {
            setValues(emptyValues(fields));
            setTouched({});
            setErrors({});
            setState("idle");
          }}
          className="mt-6 inline-flex min-h-11 items-center rounded-full px-5 text-[14px] font-medium text-ink ring-1 ring-ink/15 hover:bg-ink/5"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-7" aria-busy={state === "sending"}>
      {(heading || intro) && (
        <div>
          {heading && <h2 className="font-serif text-[30px] leading-tight text-ink">{heading}</h2>}
          {intro && <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-ink/70">{intro}</p>}
        </div>
      )}

      <div className="grid gap-7 sm:grid-cols-2">
        {fields.map((field, i) => {
          const key = fieldKey(field, i);
          const id = `${prefix}-${key}`;
          const error = touched[key] ? errors[key] : undefined;
          const describedBy = error ? `${id}-error` : undefined;
          const half = field.width === "half" && field.type !== "textarea" && field.type !== "checkbox";
          const control = cn(
            "mt-2 block w-full rounded-none border-0 border-b bg-transparent px-0 py-3 text-[17px] text-ink transition-[border-color,box-shadow] duration-200 placeholder:text-ink/35 focus:outline-none",
            // Focus thickens the rule (box-shadow, so nothing shifts); errors tint it.
            error ? "border-accent-ink focus:shadow-[0_1px_0_0_var(--color-accent-ink)]" : "border-ink/25 focus:border-ink focus:shadow-[0_1px_0_0_var(--color-ink)]",
          );
          const common = {
            id,
            required: field.required,
            "aria-invalid": error ? true : undefined,
            "aria-describedby": describedBy,
            onBlur: blur(key),
          };

          if (field.type === "checkbox") {
            return (
              <div key={key} className="sm:col-span-2">
                <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-[15px] leading-relaxed text-ink/80">
                  <input
                    {...common}
                    type="checkbox"
                    checked={values[key] === true}
                    onChange={(e) => setValue(key, e.target.checked)}
                    className="mt-1 size-4 shrink-0 accent-ink"
                  />
                  <span>
                    {field.label}
                    {field.required && <span className="text-accent-ink"> *</span>}
                  </span>
                </label>
                <FieldError id={`${id}-error`} error={error} />
              </div>
            );
          }

          const value = String(values[key] ?? "");
          const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setValue(key, e.target.value);
          return (
            <div key={key} className={half ? "" : "sm:col-span-2"}>
              <label htmlFor={id} className="kicker text-ink/60">
                {field.label}
                {field.required && <span className="text-accent-ink"> *</span>}
              </label>
              {field.type === "textarea" ? (
                <textarea {...common} rows={6} value={value} onChange={onChange} placeholder={field.placeholder} maxLength={MAX_LENGTH.textarea} className={control} />
              ) : field.type === "select" ? (
                <select {...common} value={value} onChange={onChange} className={control}>
                  <option value="" disabled>
                    {field.placeholder || "Choose an option"}
                  </option>
                  {fieldOptions(field).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  {...common}
                  type={field.type}
                  value={value}
                  onChange={onChange}
                  placeholder={field.placeholder}
                  maxLength={MAX_LENGTH[field.type]}
                  autoComplete={AUTOCOMPLETE[field.type] ?? (/name/i.test(field.label) ? "name" : undefined)}
                  inputMode={field.type === "email" ? "email" : field.type === "tel" ? "tel" : undefined}
                  className={control}
                />
              )}
              <FieldError id={`${id}-error`} error={error} />
            </div>
          );
        })}
      </div>

      {/* Honeypot: hidden from people and assistive tech; bots fill it in. */}
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${prefix}-website`}>Website</label>
        <input id={`${prefix}-website`} name="website" type="text" tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} />
      </div>

      {formError && (
        <p role="alert" className="animate-rise rounded-xl bg-accent/10 px-4 py-3 text-[14px] text-accent-ink">
          {formError}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={state === "sending"}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-7 text-[15px] font-medium text-white transition hover:bg-ink-2 active:scale-[0.98] disabled:opacity-60"
        >
          {state === "sending" && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {state === "sending" ? "Sending…" : submitLabel || "Send message"}
        </button>
      </div>
    </form>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={id} className="mt-2 animate-[fade-in-plain_0.2s_ease-out] text-[13px] text-accent-ink">
      {error}
    </p>
  );
}
