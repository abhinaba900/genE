import { beforeAll, describe, expect, it } from "vitest";
import { submitEndpoint } from "@/cms/collections/FormSubmissions";
import { fieldKey, DEFAULT_FORM_FIELDS, type FormFieldDef } from "@/lib/forms";
import { asUser, setup, uniqueSlug } from "./helpers";

type Ctx = Awaited<ReturnType<typeof setup>>;
let ctx: Ctx;


/** A page with one contact form block; returns the page and the block's id. */
async function formPage(fields?: FormFieldDef[], status: "published" | "draft" = "published") {
  const page = await ctx.payload.create({
    collection: "pages",
    data: {
      title: "Contact",
      slug: uniqueSlug(),
      _status: status,
      layout: [{ blockType: "contactForm", heading: "Write to us", successMessage: "Got it, thanks.", ...(fields ? { fields } : {}) }],
    } as never,
    draft: status === "draft",
    overrideAccess: true,
  });
  const block = (page.layout as { id: string }[])[0];
  return { page, blockId: block.id };
}

const valuesFor = (fields: FormFieldDef[], answers: (string | boolean)[]) =>
  Object.fromEntries(fields.map((f, i) => [fieldKey(f, i), answers[i]]));

let visitor = 0;
/** Each call comes from a fresh visitor address unless `ip` is given, so the rate limit stays per test. */
async function post(body: unknown, ip = `203.0.113.${++visitor}`) {
  const req = await asUser(ctx.payload, null);
  req.headers = new Headers({ "x-forwarded-for": ip });
  req.json = async () => body;
  const res = await submitEndpoint.handler(req);
  return { status: res.status, body: (await res.json().catch(() => ({}))) as { message?: string; errors?: Record<string, string> } };
}

beforeAll(async () => {
  ctx = await setup();
});

describe("contact form submissions", () => {
  it("stores a valid message from a visitor, with the block's success message", async () => {
    const { page, blockId } = await formPage();
    const values = valuesFor(DEFAULT_FORM_FIELDS, ["Asha Rao", "asha@example.com", "Story tip", "There is a great composting project near my home."]);
    const res = await post({ page: page.id, block: blockId, values });
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Got it, thanks.");

    const saved = await ctx.payload.find({ collection: "form-submissions", where: { page: { equals: page.id } }, overrideAccess: true });
    expect(saved.docs).toHaveLength(1);
    const doc = saved.docs[0];
    expect(doc).toMatchObject({ name: "Asha Rao", email: "asha@example.com", status: "new", form: "Write to us" });
    expect(doc.entries).toEqual([
      { label: "Name", type: "text", value: "Asha Rao" },
      { label: "Email", type: "email", value: "asha@example.com" },
      { label: "Topic", type: "select", value: "Story tip" },
      { label: "Message", type: "textarea", value: "There is a great composting project near my home." },
    ]);
  });

  it("rejects invalid values with an error per field, and stores nothing", async () => {
    const { page, blockId } = await formPage();
    const values = valuesFor(DEFAULT_FORM_FIELDS, ["", "not-an-email", "Made-up topic", "Hi"]);
    const res = await post({ page: page.id, block: blockId, values });
    expect(res.status).toBe(422);
    const errors = res.body.errors ?? {};
    expect(Object.keys(errors).sort()).toEqual([fieldKey(DEFAULT_FORM_FIELDS[0], 0), fieldKey(DEFAULT_FORM_FIELDS[1], 1), fieldKey(DEFAULT_FORM_FIELDS[2], 2)].sort());
    const saved = await ctx.payload.count({ collection: "form-submissions", where: { page: { equals: page.id } }, overrideAccess: true });
    expect(saved.totalDocs).toBe(0);
  });

  it("uses the fields the editor configured (phone, required checkbox)", async () => {
    const fields: FormFieldDef[] = [
      { label: "Full name", type: "text", required: true },
      { label: "Phone", type: "tel", required: true },
      { label: "I agree to be contacted", type: "checkbox", required: true },
    ];
    const { page, blockId } = await formPage(fields);
    const unticked = await post({ page: page.id, block: blockId, values: valuesFor(fields, ["Ravi", "+91 98765 43210", false]) });
    expect(unticked.status).toBe(422);
    const ok = await post({ page: page.id, block: blockId, values: valuesFor(fields, ["Ravi", "+91 98765 43210", true]) });
    expect(ok.status).toBe(200);
    const saved = await ctx.payload.find({ collection: "form-submissions", where: { page: { equals: page.id } }, overrideAccess: true });
    expect(saved.docs[0].entries).toContainEqual({ label: "I agree to be contacted", type: "checkbox", value: "Yes" });
  });

  it("silently drops bots that fill the honeypot", async () => {
    const { page, blockId } = await formPage();
    const values = valuesFor(DEFAULT_FORM_FIELDS, ["Bot", "bot@example.com", "Press", "Buy cheap things at my site right now please."]);
    const res = await post({ page: page.id, block: blockId, values, website: "https://spam.example" });
    expect(res.status).toBe(200);
    const saved = await ctx.payload.count({ collection: "form-submissions", where: { page: { equals: page.id } }, overrideAccess: true });
    expect(saved.totalDocs).toBe(0);
  });

  it("refuses forms on draft pages and unknown blocks", async () => {
    const draft = await formPage(undefined, "draft");
    const values = valuesFor(DEFAULT_FORM_FIELDS, ["A", "a@example.com", "Press", "A long enough message for the form."]);
    expect((await post({ page: draft.page.id, block: draft.blockId, values })).status).toBe(404);
    const live = await formPage();
    expect((await post({ page: live.page.id, block: "nope", values })).status).toBe(404);
  });

  it("keeps submissions private: visitors and authors cannot read them", async () => {
    await expect(ctx.payload.find({ collection: "form-submissions", overrideAccess: false })).rejects.toThrow();
    await expect(ctx.payload.find({ collection: "form-submissions", user: ctx.author, overrideAccess: false })).rejects.toThrow();
    const asEditor = await ctx.payload.find({ collection: "form-submissions", user: ctx.editor, overrideAccess: false });
    expect(asEditor.totalDocs).toBeGreaterThan(0);
  });

  it("rate-limits a sender who floods the form", async () => {
    const { page, blockId } = await formPage();
    const values = valuesFor(DEFAULT_FORM_FIELDS, ["Flood", "flood@example.com", "Press", "Sending the same message again and again."]);
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) statuses.push((await post({ page: page.id, block: blockId, values }, "198.51.100.7")).status);
    // Five go through, the sixth within the window is refused.
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });
});
