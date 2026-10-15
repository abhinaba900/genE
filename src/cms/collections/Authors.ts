import { type CollectionConfig, slugField } from "payload";
import { isEditor } from "../access";
import { preventDeleteIfReferenced, previousSlugsField, revalidateOnChange, trackPreviousSlugs, ensureUniqueSlug } from "../hooks";
import { TAGS } from "../revalidate";

const revalidation = revalidateOnChange(TAGS.authors, TAGS.stories);

/** Public bylines. Independent of CMS accounts (see Users). */
export const Authors: CollectionConfig = {
  slug: "authors",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "jobTitle", "active", "updatedAt"],
    group: "Content",
    description: "Public author profiles shown on articles. An author doesn't need a CMS login.",
  },
  access: {
    read: () => true,
    create: isEditor,
    update: isEditor,
    delete: isEditor,
  },
  defaultSort: "name",
  fields: [
    { name: "name", type: "text", required: true, label: "Full name" },
    slugField({ useAsSlug: "name", position: "sidebar" }),
    previousSlugsField,
    { name: "jobTitle", type: "text", label: "Job title or designation" },
    { name: "photo", type: "upload", relationTo: "media", label: "Profile image" },
    { name: "bio", type: "textarea", label: "Short biography", maxLength: 600 },
    {
      name: "socials",
      type: "array",
      label: "Social links",
      labels: { singular: "Link", plural: "Links" },
      fields: [
        {
          type: "row",
          fields: [
            {
              name: "platform",
              type: "select",
              required: true,
              options: ["Website", "X", "Instagram", "LinkedIn", "YouTube", "Threads", "Facebook"].map((p) => ({ label: p, value: p.toLowerCase() })),
              admin: { width: "35%" },
            },
            { name: "url", type: "text", required: true, admin: { width: "65%" }, validate: validateHttpUrl },
          ],
        },
      ],
    },
    {
      name: "active",
      type: "checkbox",
      defaultValue: true,
      admin: { position: "sidebar", description: "Inactive authors can't be picked for new stories. Their published stories are unaffected." },
    },
    {
      name: "stories",
      type: "join",
      collection: "stories",
      on: "author",
      admin: { defaultColumns: ["title", "workflowStatus", "publishedAt"] },
    },
  ],
  hooks: {
    beforeValidate: [ensureUniqueSlug("authors", "name")],
    beforeChange: [trackPreviousSlugs],
    beforeDelete: [preventDeleteIfReferenced([{ collection: "stories", field: "author", label: "stories" }])],
    afterChange: [revalidation.afterChange],
    afterDelete: [revalidation.afterDelete],
  },
};

export function validateHttpUrl(value: unknown) {
  if (!value) return true;
  try {
    const url = new URL(String(value));
    return url.protocol === "https:" || url.protocol === "http:" ? true : "Use a web address starting with https://";
  } catch {
    return "Enter a full web address, e.g. https://example.com";
  }
}
