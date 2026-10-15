import { MetaDescriptionField, MetaImageField, MetaTitleField, PreviewField } from "@payloadcms/plugin-seo/fields";
import type { Block, CollectionConfig } from "payload";
import { slugField } from "payload";
import { isEditor, publishedOrStaff } from "../access";
import { recordAudit } from "../audit";
import { previousSlugsField, revalidateOnChange, trackPreviousSlugs, ensureUniqueSlug } from "../hooks";
import { collectMediaRefs } from "../lexical-refs";
import { livePreviewBreakpoints, previewUrl } from "../preview";
import { TAGS } from "../revalidate";
import { pageEditor } from "../richtext";
import { DEFAULT_FORM_FIELDS, FORM_FIELD_TYPES } from "@/lib/forms";

/** URL segments the site already uses — a page can't take them. */
export const RESERVED_SLUGS = ["admin", "api", "stories", "category", "categories", "latest", "search", "watch", "preview", "media", "next"];

const revalidation = revalidateOnChange(TAGS.pages, TAGS.navigation);

// ── Reusable page blocks. Each maps to one presentational component on the site. ──
// The block picker shows each block's schematic thumbnail (public/cms-blocks) under a group.

const GROUP = { text: "Text & layout", media: "Media", contact: "Contact & actions" } as const;
const thumb = (name: string, alt: string) => ({ imageURL: `/cms-blocks/${name}.svg`, imageAltText: alt });

const RichTextBlock: Block = {
  slug: "richText",
  ...thumb("text", "Paragraphs of formatted text"),
  admin: { group: GROUP.text },
  labels: { singular: "Text", plural: "Text" },
  fields: [{ name: "content", type: "richText", editor: pageEditor, required: true }],
};

const SectionsBlock: Block = {
  slug: "sections",
  ...thumb("sections", "Numbered sections, each with a heading and text"),
  admin: { group: GROUP.text },
  labels: { singular: "Numbered sections", plural: "Numbered sections" },
  fields: [
    {
      name: "items",
      type: "array",
      minRows: 1,
      labels: { singular: "Section", plural: "Sections" },
      fields: [
        { name: "heading", type: "text", required: true },
        { name: "content", type: "richText", editor: pageEditor, required: true },
      ],
    },
  ],
};

const PillarsBlock: Block = {
  slug: "pillars",
  ...thumb("pillars", "Up to six numbered cards in a row"),
  admin: { group: GROUP.text },
  labels: { singular: "Pillars", plural: "Pillars" },
  fields: [
    { name: "heading", type: "text", admin: { description: "Optional, for screen readers." } },
    {
      name: "items",
      type: "array",
      minRows: 1,
      maxRows: 6,
      fields: [
        { name: "title", type: "text", required: true },
        { name: "text", type: "textarea", required: true },
      ],
    },
  ],
};

const TwoColumnBlock: Block = {
  slug: "twoColumn",
  ...thumb("heading-text", "A heading beside a column of text"),
  admin: { group: GROUP.text },
  labels: { singular: "Heading + text", plural: "Heading + text" },
  fields: [
    { name: "heading", type: "text", required: true },
    { name: "content", type: "richText", editor: pageEditor, required: true },
  ],
};

const StatementBlock: Block = {
  slug: "statement",
  ...thumb("statement", "A dark band with one or two large statements"),
  admin: { group: GROUP.text },
  labels: { singular: "Statement band", plural: "Statement bands" },
  fields: [
    {
      name: "items",
      type: "array",
      minRows: 1,
      maxRows: 2,
      fields: [
        { name: "label", type: "text", required: true },
        { name: "text", type: "textarea", required: true },
      ],
    },
  ],
};

const StoryStripBlock: Block = {
  slug: "storyStrip",
  ...thumb("posters", "A row of the latest film posters"),
  admin: { group: GROUP.media },
  labels: { singular: "Latest film posters", plural: "Latest film posters" },
  fields: [{ name: "count", type: "number", defaultValue: 4, min: 2, max: 8 }],
};

const ImageBlock: Block = {
  slug: "image",
  ...thumb("image", "A full-width image with a caption"),
  admin: { group: GROUP.media },
  labels: { singular: "Image", plural: "Images" },
  fields: [
    { name: "image", type: "upload", relationTo: "media", required: true },
    { name: "caption", type: "text" },
  ],
};

const CallToActionBlock: Block = {
  slug: "callToAction",
  ...thumb("cta", "A sentence with a button"),
  admin: { group: GROUP.contact },
  labels: { singular: "Call to action", plural: "Calls to action" },
  fields: [
    { name: "text", type: "text", required: true },
    {
      type: "row",
      fields: [
        { name: "label", type: "text", required: true, admin: { width: "40%" } },
        {
          name: "href",
          type: "text",
          required: true,
          admin: { width: "60%", description: "A site path like /contact, or a full https:// link." },
          validate: (v: unknown) => (/^(\/|https:\/\/|mailto:)/.test(String(v ?? "")) ? true : "Start with /, https:// or mailto:"),
        },
      ],
    },
  ],
};

const ContactFormBlock: Block = {
  slug: "contactForm",
  ...thumb("contact-form", "A form visitors fill in; messages arrive in Form submissions"),
  admin: { group: GROUP.contact },
  labels: { singular: "Contact form", plural: "Contact forms" },
  fields: [
    {
      type: "row",
      fields: [
        { name: "heading", type: "text", defaultValue: "Send a message", admin: { width: "60%" } },
        { name: "submitLabel", type: "text", label: "Button label", defaultValue: "Send message", admin: { width: "40%" } },
      ],
    },
    { name: "intro", type: "textarea", admin: { description: "Optional line under the heading." } },
    {
      name: "fields",
      type: "array",
      label: "Form fields",
      labels: { singular: "Field", plural: "Fields" },
      minRows: 1,
      maxRows: 12,
      defaultValue: DEFAULT_FORM_FIELDS,
      admin: {
        initCollapsed: true,
        description: "What visitors fill in, top to bottom. Two half-width fields in a row sit side by side.",
        components: { RowLabel: "@/cms/admin/fields/FormFieldRowLabel#FormFieldRowLabel" },
      },
      fields: [
        {
          type: "row",
          fields: [
            { name: "label", type: "text", required: true, admin: { width: "45%" } },
            { name: "type", type: "select", required: true, defaultValue: "text", options: [...FORM_FIELD_TYPES], admin: { width: "30%" } },
            {
              name: "width",
              type: "select",
              defaultValue: "full",
              options: [
                { label: "Full width", value: "full" },
                { label: "Half width", value: "half" },
              ],
              admin: { width: "25%" },
            },
          ],
        },
        {
          type: "row",
          fields: [
            { name: "placeholder", type: "text", admin: { width: "70%", condition: (_, row) => row?.type !== "checkbox" } },
            { name: "required", type: "checkbox", defaultValue: false, admin: { width: "30%", style: { alignSelf: "flex-end" } } },
          ],
        },
        {
          name: "options",
          type: "textarea",
          label: "Dropdown options",
          admin: { description: "One option per line.", condition: (_, row) => row?.type === "select" },
          validate: (value: unknown, { siblingData }: { siblingData: { type?: string } }) =>
            siblingData?.type !== "select" || String(value ?? "").trim() ? true : "Add at least one option.",
        },
      ],
    },
    {
      name: "successMessage",
      type: "textarea",
      defaultValue: "Thanks — your message has reached the gen.E team. We'll get back to you soon.",
      admin: { description: "Shown after a visitor sends the form." },
    },
    {
      name: "notifyEmail",
      type: "email",
      label: "Also email submissions to",
      admin: { description: "Optional. Every message is saved in Form submissions; this also emails a copy (needs SMTP configured)." },
    },
  ],
};

const ContactDetailsBlock: Block = {
  slug: "contactDetails",
  ...thumb("contact-details", "Labelled contact details such as email and address"),
  admin: { group: GROUP.contact },
  labels: { singular: "Contact details", plural: "Contact details" },
  fields: [
    {
      name: "items",
      type: "array",
      fields: [
        { name: "label", type: "text", required: true },
        { name: "value", type: "text", required: true },
        { name: "href", type: "text", admin: { description: "Optional link, e.g. mailto:hello@gen-e.in" } },
      ],
    },
  ],
};

export const pageBlocks = [
  RichTextBlock,
  SectionsBlock,
  TwoColumnBlock,
  PillarsBlock,
  StatementBlock,
  StoryStripBlock,
  ImageBlock,
  CallToActionBlock,
  ContactDetailsBlock,
  ContactFormBlock,
];

export const Pages: CollectionConfig = {
  slug: "pages",
  admin: {
    group: "Website",
    useAsTitle: "title",
    defaultColumns: ["title", "slug", "_status", "updatedAt"],
    description: "About, contact, legal and other information pages, built from reusable blocks.",
    preview: (doc) => previewUrl("pages", doc?.id as number | undefined),
    livePreview: { url: ({ data }) => previewUrl("pages", data?.id as number | undefined), breakpoints: livePreviewBreakpoints },
  },
  access: {
    read: publishedOrStaff,
    create: isEditor,
    update: isEditor,
    delete: isEditor,
    readVersions: isEditor,
  },
  versions: { maxPerDoc: 25, drafts: { autosave: { interval: 2500 } } },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Content",
          fields: [
            { name: "title", type: "text", required: true },
            {
              name: "template",
              type: "radio",
              defaultValue: "standard",
              options: [
                { label: "Standard (title + intro side by side)", value: "standard" },
                { label: "Feature (large headline)", value: "feature" },
                { label: "Contact (form beside the details)", value: "contact" },
              ],
              admin: { layout: "horizontal" },
            },
            {
              type: "row",
              fields: [
                { name: "kicker", type: "text", admin: { width: "35%", description: "Small label above the title, e.g. “Legal”." } },
                { name: "intro", type: "textarea", admin: { width: "65%" } },
              ],
            },
            {
              name: "notice",
              type: "textarea",
              admin: { description: "Optional highlighted note above the content (e.g. “Draft — not yet approved by legal”)." },
            },
            { name: "heroImage", type: "upload", relationTo: "media", label: "Featured image" },
            { name: "layout", type: "blocks", blocks: pageBlocks, label: "Page content" },
          ],
        },
        {
          name: "seo",
          label: "SEO",
          fields: [
            MetaTitleField({ hasGenerateFn: true }),
            MetaDescriptionField({ hasGenerateFn: true }),
            MetaImageField({ relationTo: "media" }),
            PreviewField({ hasGenerateFn: true, titlePath: "seo.title", descriptionPath: "seo.description" }),
            { name: "noIndex", type: "checkbox", label: "Hide from search engines" },
          ],
        },
      ],
    },
    slugField({
      useAsSlug: "title",
      position: "sidebar",
      overrides: (row) => {
        const slug = row.fields.find((f) => "name" in f && f.name === "slug");
        if (slug && slug.type === "text") {
          slug.validate = (value: unknown) =>
            RESERVED_SLUGS.includes(String(value)) ? `“${value}” is used by another part of the site.` : true;
        }
        return row;
      },
    }),
    previousSlugsField,
    { name: "mediaRefs", type: "relationship", relationTo: "media", hasMany: true, admin: { hidden: true } },
  ],
  hooks: {
    beforeValidate: [ensureUniqueSlug("pages", "title")],
    beforeChange: [
      trackPreviousSlugs,
      ({ data }) => {
        data.mediaRefs = collectMediaRefs(data);
        return data;
      },
    ],
    afterChange: [
      revalidation.afterChange,
      async ({ doc, previousDoc, req, operation }) => {
        if (doc._status === "published" && previousDoc?._status !== "published") {
          await recordAudit(req, { action: "published", collection: "pages", docId: doc.id, title: doc.title });
        } else if (operation === "create") {
          await recordAudit(req, { action: "created", collection: "pages", docId: doc.id, title: doc.title });
        }
        return doc;
      },
    ],
    afterDelete: [revalidation.afterDelete],
  },
};
