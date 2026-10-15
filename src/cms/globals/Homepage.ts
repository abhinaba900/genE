import type { GlobalConfig } from "payload";
import { isEditor } from "../access";
import { livePreviewBreakpoints } from "../preview";
import { TAGS, revalidate } from "../revalidate";
import { SITE_URL } from "@/lib/site";

const ORDERING = [
  { label: "Latest first", value: "latest" },
  { label: "Featured first, then latest", value: "featured_first" },
  { label: "Manually curated (then latest)", value: "curated" },
];

const publishedStory = { _status: { equals: "published" } } as const;

/**
 * Editorial control of the mobile feed and the desktop homepage.
 *
 * Feed order is deterministic: pinned stories (in the order listed) → the ordering rule →
 * ties broken by publication date, then id. Unpublished, future-dated and archived stories
 * are filtered out at query time, so curating a story here never publishes it.
 */
export const Homepage: GlobalConfig = {
  slug: "homepage",
  label: "Homepage & feed",
  admin: {
    group: "Website",
    description: "Drag stories to reorder. Changes go live when you publish this page.",
    livePreview: { url: `${SITE_URL}/preview/home`, breakpoints: livePreviewBreakpoints },
  },
  access: { read: () => true, update: isEditor, readVersions: isEditor },
  versions: { max: 25, drafts: { autosave: { interval: 2500 } } },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Mobile feed",
          fields: [
            {
              name: "feedOrdering",
              type: "radio",
              defaultValue: "latest",
              options: ORDERING,
              label: "Ordering",
              admin: { layout: "vertical" },
            },
            {
              name: "pinned",
              type: "relationship",
              relationTo: "stories",
              hasMany: true,
              maxRows: 5,
              filterOptions: publishedStory,
              label: "Pinned to the top",
              admin: { description: "Always first, in this order. Up to 5." },
            },
            {
              name: "curated",
              type: "relationship",
              relationTo: "stories",
              hasMany: true,
              filterOptions: publishedStory,
              label: "Curated order",
              admin: {
                description: "Used with “Manually curated”. Stories not listed follow, newest first.",
                condition: (data) => data?.feedOrdering === "curated",
              },
            },
            {
              name: "categoryFeeds",
              type: "array",
              label: "Category feeds",
              admin: { description: "Optional per-category overrides. Categories without an entry use “Latest first”." },
              labels: { singular: "Category feed", plural: "Category feeds" },
              fields: [
                {
                  type: "row",
                  fields: [
                    { name: "category", type: "relationship", relationTo: "categories", required: true, admin: { width: "50%" } },
                    { name: "ordering", type: "select", defaultValue: "latest", options: ORDERING, admin: { width: "50%" } },
                  ],
                },
                { name: "pinned", type: "relationship", relationTo: "stories", hasMany: true, maxRows: 5, filterOptions: publishedStory },
                {
                  name: "curated",
                  type: "relationship",
                  relationTo: "stories",
                  hasMany: true,
                  filterOptions: publishedStory,
                  admin: { condition: (_, sibling) => sibling?.ordering === "curated" },
                },
              ],
            },
          ],
        },
        {
          label: "Desktop homepage",
          fields: [
            {
              name: "mainFeatured",
              type: "relationship",
              relationTo: "stories",
              filterOptions: publishedStory,
              label: "Main featured story",
              admin: { description: "If empty, the newest featured story is used." },
            },
            {
              name: "secondaryFeatured",
              type: "relationship",
              relationTo: "stories",
              hasMany: true,
              maxRows: 5,
              filterOptions: publishedStory,
              label: "Reels row",
              admin: { description: "Up to 5 stories for “Today’s reels”. Filled with the latest stories when empty." },
            },
            {
              type: "row",
              fields: [
                { name: "latestCount", type: "number", defaultValue: 5, min: 1, max: 12, label: "Latest stories shown", admin: { width: "50%" } },
                {
                  name: "sidebarMode",
                  type: "select",
                  defaultValue: "auto",
                  label: "Sidebar list",
                  admin: { width: "50%", description: "“Trending” appears only when real view data exists." },
                  options: [
                    { label: "Trending when available, else Editor’s picks", value: "auto" },
                    { label: "Always Editor’s picks", value: "picks" },
                  ],
                },
              ],
            },
            {
              name: "editorsPicks",
              type: "relationship",
              relationTo: "stories",
              hasMany: true,
              maxRows: 6,
              filterOptions: publishedStory,
              label: "Editor’s picks",
            },
            {
              name: "topicCategories",
              type: "relationship",
              relationTo: "categories",
              hasMany: true,
              label: "Topics section",
              admin: { description: "Categories shown in “Explore by topic”. All enabled categories when empty." },
            },
          ],
        },
        {
          label: "Preview",
          fields: [{ name: "previewNote", type: "ui", admin: { components: { Field: "@/cms/admin/fields/HomepagePreviewHint#HomepagePreviewHint" } } }],
        },
      ],
    },
  ],
  hooks: {
    afterChange: [
      ({ doc }) => {
        revalidate(TAGS.homepage);
        return doc;
      },
    ],
  },
};
