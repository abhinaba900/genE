import { type CollectionConfig, slugField } from "payload";
import { isEditor, staffUser } from "../access";
import { preventDeleteIfReferenced, previousSlugsField, revalidateOnChange, trackPreviousSlugs, ensureUniqueSlug } from "../hooks";
import { TAGS } from "../revalidate";

const revalidation = revalidateOnChange(TAGS.categories, TAGS.stories, TAGS.navigation);

export const Categories: CollectionConfig = {
  slug: "categories",
  labels: { singular: "Category", plural: "Categories" },
  orderable: true,
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "slug", "enabled", "featured", "updatedAt"],
    group: "Content",
    description: "Drag rows to set the order categories appear in on the website.",
  },
  access: {
    // Visitors see enabled categories only; the team sees everything.
    read: ({ req }) => (staffUser(req) ? true : { enabled: { equals: true } }),
    create: isEditor,
    update: isEditor,
    delete: isEditor,
  },
  fields: [
    { name: "name", type: "text", required: true, unique: true },
    slugField({ useAsSlug: "name", position: "sidebar" }),
    previousSlugsField,
    { name: "description", type: "textarea", maxLength: 300, admin: { description: "One sentence shown on the category page." } },
    {
      name: "tint",
      type: "text",
      defaultValue: "#ece9e2",
      label: "Card tint",
      admin: {
        description: "Soft background colour for this category's cards (hex, e.g. #dfe5d5).",
        components: { Field: "@/cms/admin/fields/ColorField#ColorField" },
      },
      validate: (value: unknown) => (!value || /^#[0-9a-f]{6}$/i.test(String(value)) ? true : "Use a 6-digit hex colour like #dfe5d5"),
    },
    { name: "image", type: "upload", relationTo: "media", admin: { description: "Optional artwork for category tiles." } },
    {
      name: "enabled",
      type: "checkbox",
      defaultValue: true,
      admin: { position: "sidebar", description: "Disabled categories are hidden from navigation and their pages return 404." },
    },
    {
      name: "featured",
      type: "checkbox",
      defaultValue: false,
      admin: { position: "sidebar", description: "Featured categories are offered first in navigation." },
    },
    {
      name: "stories",
      type: "join",
      collection: "stories",
      on: "category",
      admin: { defaultColumns: ["title", "workflowStatus", "publishedAt"] },
    },
  ],
  hooks: {
    beforeValidate: [ensureUniqueSlug("categories", "name")],
    beforeChange: [trackPreviousSlugs],
    beforeDelete: [
      preventDeleteIfReferenced([
        { collection: "stories", field: "category", label: "stories (primary category)" },
        { collection: "stories", field: "additionalCategories", label: "stories (additional category)" },
      ]),
    ],
    afterChange: [revalidation.afterChange],
    afterDelete: [revalidation.afterDelete],
  },
};
