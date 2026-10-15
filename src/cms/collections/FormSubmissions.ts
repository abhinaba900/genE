import type { CollectionConfig, Endpoint } from "payload";
import { fieldKey, resolveFields, validateForm, type FormFieldDef, type FormValues } from "@/lib/forms";
import { isEditor } from "../access";

// In-memory limiter per visitor IP (kept in memory only, never stored): a person can send a
// handful of messages; a script can't flood the inbox.
const WINDOW_MS = 10 * 60_000;
const MAX_PER_WINDOW = 5;
const buckets = new Map<string, { count: number; reset: number }>();

function limited(key: string) {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    buckets.set(key, { count: 1, reset: now + WINDOW_MS });
    if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
    return false;
  }
  bucket.count++;
  return bucket.count > MAX_PER_WINDOW;
}

type ContactBlock = {
  id?: string | null;
  blockType: string;
  heading?: string | null;
  fields?: FormFieldDef[] | null;
  successMessage?: string | null;
  notifyEmail?: string | null;
};

/**
 * POST /api/form-submissions/submit  { page, block, values, website }
 *
 * Accepts a message from a contact form block on a published page. The block's own field
 * definitions decide what's valid, so editors change the form without touching code.
 * `website` is a honeypot: humans never see it, bots fill it in and are silently dropped.
 */
export const submitEndpoint: Endpoint = {
  path: "/submit",
  method: "post",
  handler: async (req) => {
    const body = (await req.json?.().catch(() => null)) as { page?: unknown; block?: unknown; values?: unknown; website?: unknown } | null;
    if (!body || typeof body.block !== "string" || !body.values || typeof body.values !== "object") {
      return Response.json({ message: "Invalid submission." }, { status: 400 });
    }
    // Pretend success for bots so they don't retry.
    if (typeof body.website === "string" && body.website.trim()) return Response.json({ ok: true });

    const ip = req.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers?.get("x-real-ip") || "local";
    if (limited(ip)) return Response.json({ message: "Too many messages — please try again in a few minutes." }, { status: 429 });

    const pageId = Number(body.page);
    // Public read access only returns published pages, so drafts can't receive submissions.
    const page = pageId
      ? await req.payload.findByID({ collection: "pages", id: pageId, depth: 0, overrideAccess: false, disableErrors: true }).catch(() => null)
      : null;
    const block = (page?.layout as ContactBlock[] | undefined)?.find((b) => b.blockType === "contactForm" && b.id === body.block);
    if (!page || !block) return Response.json({ message: "This form is no longer available." }, { status: 404 });

    const fields = resolveFields(block.fields);
    const values = body.values as FormValues;
    const errors = validateForm(fields, values);
    if (Object.keys(errors).length) return Response.json({ message: "Please check the highlighted fields.", errors }, { status: 422 });

    const entries = fields.map((field, i) => {
      const raw = values[fieldKey(field, i)];
      const value = field.type === "checkbox" ? (raw === true ? "Yes" : "No") : String(raw ?? "").trim();
      return { label: field.label, type: field.type, value };
    });
    const byType = (type: string) => entries.find((e) => e.type === type && e.value)?.value;
    const name = entries.find((e) => e.type === "text" && /name/i.test(e.label) && e.value)?.value ?? byType("text");
    const email = byType("email");

    await req.payload.create({
      collection: "form-submissions",
      data: { page: page.id, form: block.heading || "Contact form", name, email, entries, status: "new" },
      overrideAccess: true,
      req,
    });

    if (block.notifyEmail && process.env.SMTP_HOST) {
      // Never fail the visitor's submission because the notification couldn't be sent.
      await req.payload
        .sendEmail({
          to: block.notifyEmail,
          replyTo: email,
          subject: `New message from ${name ?? "the website"} — ${page.title}`,
          text: entries.map((e) => `${e.label}: ${e.value || "—"}`).join("\n\n"),
        })
        .catch((err: unknown) => req.payload.logger.error({ err }, "Form notification email failed"));
    }

    return Response.json({ ok: true, message: block.successMessage ?? undefined });
  },
};

/**
 * Messages sent through contact form blocks. Created only by the submit endpoint;
 * editors read them, mark them handled, and delete them.
 */
export const FormSubmissions: CollectionConfig = {
  slug: "form-submissions",
  labels: { singular: "Form submission", plural: "Form submissions" },
  admin: {
    group: "Website",
    useAsTitle: "name",
    defaultColumns: ["name", "email", "form", "page", "status", "createdAt"],
    listSearchableFields: ["name", "email"],
    description: "Messages sent through contact forms on the website.",
  },
  access: {
    read: isEditor,
    create: () => false,
    update: isEditor,
    delete: isEditor,
  },
  defaultSort: "-createdAt",
  fields: [
    {
      name: "status",
      type: "select",
      defaultValue: "new",
      index: true,
      options: [
        { label: "New", value: "new" },
        { label: "Read", value: "read" },
        { label: "Replied", value: "replied" },
        { label: "Spam", value: "spam" },
      ],
      admin: { position: "sidebar", components: { Cell: "@/cms/admin/fields/SubmissionStatusCell#SubmissionStatusCell" } },
    },
    { name: "name", type: "text", admin: { readOnly: true } },
    { name: "email", type: "email", admin: { readOnly: true } },
    {
      type: "row",
      fields: [
        { name: "form", type: "text", label: "Form", admin: { readOnly: true, width: "50%" } },
        { name: "page", type: "relationship", relationTo: "pages", admin: { readOnly: true, width: "50%" } },
      ],
    },
    {
      name: "entries",
      type: "json",
      label: "Message",
      admin: { readOnly: true, components: { Field: "@/cms/admin/fields/SubmissionEntries#SubmissionEntries" } },
    },
    { name: "internalNote", type: "textarea", label: "Internal note", admin: { position: "sidebar", description: "Only visible to the team." } },
  ],
  endpoints: [submitEndpoint],
  timestamps: true,
};
