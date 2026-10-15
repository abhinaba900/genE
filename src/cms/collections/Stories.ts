import { MetaDescriptionField, MetaImageField, MetaTitleField, OverviewField, PreviewField } from "@payloadcms/plugin-seo/fields";
import { APIError, type CollectionConfig, slugField } from "payload";
import { hasRole, isEditorField, staffUser, storyDelete, storyRead, storyUpdate } from "../access";
import { recordAudit } from "../audit";
import { previousSlugsField, trackPreviousSlugs, ensureUniqueSlug } from "../hooks";
import { TAGS, revalidate } from "../revalidate";
import { limitListColumns } from "../admin/listColumns";
import { articleEditor } from "../richtext";
import { livePreviewBreakpoints, previewUrl } from "../preview";
import { collectMediaRefs } from "../lexical-refs";
import { workflowEndpoint } from "../workflow";
import { lexicalToBlocks, readingTime } from "@/lib/content/payload/lexical";

export const WORKFLOW_STATUSES = [
  { label: "Draft", value: "draft" },
  { label: "In review", value: "in_review" },
  { label: "Changes requested", value: "changes_requested" },
  { label: "Approved", value: "approved" },
  { label: "Scheduled", value: "scheduled" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number]["value"];

/**
 * A story is one video plus one article, edited together on one screen.
 *
 * Two status fields, with distinct jobs:
 *  - `_status` (Payload drafts): draft | published. The only thing that decides what the public sees.
 *  - `workflowStatus`: the editorial state shown to the team (in review, approved, scheduled…).
 * Saving never publishes. Publishing requires the publish permission (editors and admins).
 */
/** Fields offered in the stories list's "Columns" picker; the rest are editor-only. */
const LIST_COLUMNS = [
  "title",
  "shortTitle",
  "category",
  "author",
  "additionalCategories",
  "tags",
  "video",
  "featuredImage",
  "workflowStatus",
  "featured",
  "hideFromFeed",
  "publishedAt",
  "scheduledFor",
  "slug",
  "createdBy",
] as const;

export const Stories: CollectionConfig = {
  slug: "stories",
  labels: { singular: "Story", plural: "Stories" },
  trash: true,
  admin: {
    group: "Content",
    useAsTitle: "title",
    defaultColumns: ["title", "category", "author", "workflowStatus", "featured", "publishedAt", "updatedAt"],
    listSearchableFields: ["title", "shortTitle", "slug"],
    description: "Each story is a vertical film plus its full article.",
    pagination: { defaultLimit: 25 },
    preview: (doc) => previewUrl("stories", doc?.id as number | undefined),
    livePreview: {
      url: ({ data }) => previewUrl("stories", data?.id as number | undefined),
      breakpoints: livePreviewBreakpoints,
    },
    components: {
      edit: { beforeDocumentControls: ["@/cms/admin/workflow/WorkflowBadge#WorkflowBadge"] },
    },
  },
  access: {
    read: storyRead,
    create: ({ req }) => Boolean(staffUser(req)),
    update: storyUpdate,
    delete: storyDelete,
    readVersions: ({ req }) => Boolean(staffUser(req)),
  },
  versions: {
    maxPerDoc: 50,
    drafts: { autosave: { interval: 2500 }, validate: false },
  },
  defaultSort: "-updatedAt",
  fields: limitListColumns([
    {
      type: "tabs",
      tabs: [
        {
          label: "Story",
          fields: [
            {
              name: "title",
              type: "text",
              required: true,
              label: "Headline",
              maxLength: 160,
              admin: { components: { Cell: "@/cms/admin/fields/StoryTitleCell#StoryTitleCell" } },
            },
            {
              name: "shortTitle",
              type: "text",
              label: "Feed headline",
              maxLength: 90,
              admin: { description: "Shorter headline for the video feed. Leave empty to use the headline." },
            },
            {
              name: "excerpt",
              type: "textarea",
              required: true,
              label: "Summary",
              maxLength: 280,
              admin: { description: "One or two sentences. Shown on the feed, cards and search results." },
            },
            {
              type: "row",
              fields: [
                {
                  name: "category",
                  type: "relationship",
                  relationTo: "categories",
                  required: true,
                  index: true,
                  label: "Primary category",
                  admin: { width: "50%" },
                },
                {
                  name: "author",
                  type: "relationship",
                  relationTo: "authors",
                  required: true,
                  index: true,
                  filterOptions: { active: { equals: true } },
                  admin: { width: "50%" },
                },
              ],
            },
            {
              type: "row",
              fields: [
                {
                  name: "additionalCategories",
                  type: "relationship",
                  relationTo: "categories",
                  hasMany: true,
                  admin: { width: "50%" },
                },
                { name: "tags", type: "relationship", relationTo: "tags", hasMany: true, admin: { width: "50%" } },
              ],
            },
            {
              name: "sourceUrl",
              type: "text",
              label: "Originally published at",
              admin: { description: "Optional. Link to the original post (e.g. the YouTube Short); shown at the end of the article." },
              validate: (v: unknown) => (!v || /^https:\/\//.test(String(v)) ? true : "Must be an https:// URL"),
            },
          ],
        },
        {
          label: "Video",
          fields: [
            {
              name: "video",
              type: "upload",
              relationTo: "videos",
              required: true,
              admin: { description: "Upload a new film or choose one from the library. Title, poster and captions are edited on the video." },
            },
            {
              name: "videoPreview",
              type: "ui",
              admin: { disableListColumn: true, components: { Field: "@/cms/admin/fields/StoryVideoPreview#StoryVideoPreview" } },
            },
          ],
        },
        {
          label: "Article",
          fields: [{ name: "content", type: "richText", required: true, label: false, editor: articleEditor }],
        },
        {
          label: "Images",
          fields: [
            {
              name: "featuredImage",
              type: "upload",
              relationTo: "media",
              filterOptions: { mimeType: { contains: "image" } },
              admin: {
                description: "Used on cards and as the sharing image. If empty, the video's poster is used.",
              },
            },
          ],
        },
        {
          name: "seo",
          label: "SEO",
          fields: [
            OverviewField({ titlePath: "seo.title", descriptionPath: "seo.description", imagePath: "seo.image" }),
            MetaTitleField({ hasGenerateFn: true, overrides: { admin: { description: "Defaults to the headline." } } }),
            MetaDescriptionField({ hasGenerateFn: true, overrides: { admin: { description: "Defaults to the summary." } } }),
            MetaImageField({ relationTo: "media", hasGenerateFn: true, overrides: { label: "Social sharing image" } }),
            PreviewField({ hasGenerateFn: true, titlePath: "seo.title", descriptionPath: "seo.description" }),
            {
              type: "row",
              fields: [
                { name: "ogTitle", type: "text", label: "Open Graph title", admin: { width: "50%", description: "Defaults to the SEO title." } },
                {
                  name: "canonicalUrl",
                  type: "text",
                  label: "Canonical URL",
                  admin: { width: "50%", description: "Only if this story was first published elsewhere." },
                  validate: (v: unknown) => (!v || /^https:\/\//.test(String(v)) ? true : "Must be an https:// URL"),
                },
              ],
            },
            { name: "ogDescription", type: "textarea", label: "Open Graph description", admin: { description: "Defaults to the meta description." } },
            {
              name: "noIndex",
              type: "checkbox",
              label: "Hide from search engines",
              admin: { description: "Adds noindex. The story stays visible on gen.E." },
            },
          ],
        },
      ],
    },
    // ── Sidebar ──
    {
      name: "workflow",
      type: "ui",
      admin: { position: "sidebar", components: { Field: "@/cms/admin/workflow/WorkflowPanel#WorkflowPanel" } },
    },
    {
      name: "workflowStatus",
      type: "select",
      label: "Editorial status",
      defaultValue: "draft",
      index: true,
      options: [...WORKFLOW_STATUSES],
      // Changed through the workflow panel (and its server endpoint), never by typing.
      access: { update: isEditorField, create: () => false },
      admin: { position: "sidebar", readOnly: true, hidden: true, components: { Cell: "@/cms/admin/workflow/StatusCell#StatusCell" } },
    },
    {
      name: "scheduledFor",
      type: "date",
      index: true,
      access: { update: isEditorField, create: () => false },
      admin: { hidden: true },
    },
    slugField({ useAsSlug: "title", position: "sidebar" }),
    previousSlugsField,
    {
      name: "publishedAt",
      type: "date",
      index: true,
      label: "Publication date",
      admin: {
        position: "sidebar",
        date: { pickerAppearance: "dayAndTime" },
        description: "Set automatically on first publish. Editors can backdate.",
      },
    },
    {
      name: "featured",
      type: "checkbox",
      defaultValue: false,
      index: true,
      access: { update: isEditorField, create: isEditorField },
      admin: { position: "sidebar", description: "Prioritised in “featured-first” feeds and homepage slots." },
    },
    {
      name: "hideFromFeed",
      type: "checkbox",
      defaultValue: false,
      label: "Hide from feeds",
      access: { update: isEditorField, create: isEditorField },
      admin: { position: "sidebar", description: "Keeps the article live but leaves it out of the video feeds and homepage lists." },
    },
    {
      name: "reviewNote",
      type: "textarea",
      label: "Note to the team",
      admin: { position: "sidebar", description: "Context for reviewers, or the editor's requested changes." },
    },
    {
      name: "createdBy",
      type: "relationship",
      relationTo: "users",
      index: true,
      access: { update: () => false },
      admin: { position: "sidebar", readOnly: true, description: "Story owner." },
    },
    { name: "firstPublishedAt", type: "date", admin: { hidden: true }, access: { update: () => false } },
    { name: "readingTime", type: "number", admin: { hidden: true } },
    // Every image the story uses (featured, social, inline), so the media library knows what is in use.
    { name: "mediaRefs", type: "relationship", relationTo: "media", hasMany: true, index: true, admin: { hidden: true } },
  ], LIST_COLUMNS),
  endpoints: [workflowEndpoint],
  hooks: {
    beforeValidate: [ensureUniqueSlug("stories", "title")],
    beforeOperation: [
      ({ args, operation, req }) => {
        if (operation === "update" || operation === "create") {
          req.context.isDraftSave = Boolean(args.draft) && args.data?._status !== "published";
          req.context.isAutosave = Boolean(args.autosave);
        }
        return args;
      },
    ],
    beforeChange: [
      trackPreviousSlugs,
      async ({ data, operation, originalDoc, req }) => {
        const user = staffUser(req);
        if (operation === "create") {
          if (user) data.createdBy = user.id;
          data.workflowStatus = data._status === "published" ? "published" : "draft";
          if (!data.author && user) {
            const profile = await req.payload
              .findByID({ collection: "users", id: user.id, depth: 0, overrideAccess: true, req })
              .then((u) => u.authorProfile)
              .catch(() => null);
            if (profile) data.author = typeof profile === "object" ? profile.id : profile;
          }
        }

        data.mediaRefs = collectMediaRefs(data);
        if (data.content) data.readingTime = readingTime(lexicalToBlocks(data.content));

        const publishing = data._status === "published";
        const unpublishing =
          !publishing && !req.context.isDraftSave && originalDoc?._status === "published" && data._status === "draft";

        if (publishing) {
          if (!hasRole(req, "admin", "editor") && !req.context.systemPublish) {
            throw new APIError("Only editors can publish. Submit the story for review instead.", 403, undefined, true);
          }
          const now = new Date();
          if (data.publishedAt && new Date(data.publishedAt).getTime() > now.getTime() + 60_000 && !req.context.systemPublish) {
            throw new APIError("The publication date is in the future. Use “Schedule” to publish later.", 400, undefined, true);
          }
          data.publishedAt ||= now.toISOString();
          data.firstPublishedAt = originalDoc?.firstPublishedAt ?? now.toISOString();
          data.workflowStatus = "published";
          data.scheduledFor = null;
        } else if (unpublishing) {
          data.workflowStatus = req.context.workflowTarget === "archived" ? "archived" : "draft";
        }
        req.context.storyTransition = publishing && originalDoc?._status !== "published" ? "published" : unpublishing ? "unpublished" : null;
        return data;
      },
    ],
    afterChange: [
      async ({ doc, operation, previousDoc, req }) => {
        const transition = req.context.storyTransition as string | null;
        if (operation === "create") {
          await recordAudit(req, { action: "created", collection: "stories", docId: doc.id, title: doc.title });
        } else if (transition === "published" || transition === "unpublished") {
          await recordAudit(req, {
            action: req.context.workflowTarget === "archived" ? "archived" : transition,
            collection: "stories",
            docId: doc.id,
            title: doc.title,
          });
        } else if (!req.context.isAutosave && !req.context.workflowAction && doc.deletedAt && !previousDoc?.deletedAt) {
          await recordAudit(req, { action: "trashed", collection: "stories", docId: doc.id, title: doc.title });
        } else if (!req.context.isAutosave && !req.context.workflowAction) {
          await recordAudit(req, { action: "updated", collection: "stories", docId: doc.id, title: doc.title });
        }
        // Draft saves never change what the public sees.
        if (!req.context.isDraftSave) revalidate(TAGS.stories);
        return doc;
      },
    ],
    afterDelete: [
      async ({ doc, req }) => {
        await recordAudit(req, { action: "deleted", collection: "stories", docId: doc.id, title: doc.title });
        revalidate(TAGS.stories);
        return doc;
      },
    ],
  },
};
