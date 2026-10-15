import {
  BlockquoteFeature,
  BlocksFeature,
  BoldFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineToolbarFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  StrikethroughFeature,
  UnderlineFeature,
  UnorderedListFeature,
  UploadFeature,
  lexicalEditor,
} from "@payloadcms/richtext-lexical";
import type { Block } from "payload";

export const PullQuoteBlock: Block = {
  slug: "pullQuote",
  labels: { singular: "Pull quote", plural: "Pull quotes" },
  fields: [
    { name: "text", type: "textarea", required: true, maxLength: 400 },
    { name: "attribution", type: "text" },
  ],
};

export const EmbedBlock: Block = {
  slug: "embed",
  labels: { singular: "Embedded media", plural: "Embedded media" },
  fields: [
    {
      name: "url",
      type: "text",
      required: true,
      label: "Link",
      admin: { description: "YouTube and Vimeo links play inline. Other links appear as a link card." },
      validate: (value: unknown) => {
        try {
          return new URL(String(value)).protocol === "https:" ? true : "Use an https:// link";
        } catch {
          return "Paste a full link, e.g. https://www.youtube.com/watch?v=…";
        }
      },
    },
    { name: "title", type: "text", admin: { description: "Accessible title for the embed." } },
    { name: "caption", type: "text" },
  ],
};

export const VideoBlock: Block = {
  slug: "video",
  labels: { singular: "Video", plural: "Videos" },
  fields: [
    { name: "video", type: "upload", relationTo: "videos", required: true },
    { name: "caption", type: "text" },
  ],
};

/**
 * A deliberately constrained editor: the formatting gen.E articles use, nothing that
 * could inject raw HTML. The public site renders the stored JSON through typed
 * components (see `lib/content/payload/lexical.ts`), never `dangerouslySetInnerHTML`.
 */
export const articleEditor = lexicalEditor({
  features: () => [
    ParagraphFeature(),
    HeadingFeature({ enabledHeadingSizes: ["h2", "h3"] }),
    BoldFeature(),
    ItalicFeature(),
    UnderlineFeature(),
    StrikethroughFeature(),
    LinkFeature({
      enabledCollections: ["stories", "pages"],
      fields: ({ defaultFields }) => defaultFields,
    }),
    UnorderedListFeature(),
    OrderedListFeature(),
    BlockquoteFeature(),
    HorizontalRuleFeature(),
    UploadFeature({
      collections: {
        media: {
          fields: [
            { name: "caption", type: "text", admin: { description: "Overrides the image's default caption." } },
            {
              name: "layout",
              type: "select",
              defaultValue: "inline",
              options: [
                { label: "Text width", value: "inline" },
                { label: "Wide", value: "wide" },
              ],
            },
          ],
        },
      },
    }),
    BlocksFeature({ blocks: [PullQuoteBlock, EmbedBlock, VideoBlock] }),
    FixedToolbarFeature(),
    InlineToolbarFeature(),
  ],
});

/** Simpler editor for static page sections. */
export const pageEditor = lexicalEditor({
  features: () => [
    ParagraphFeature(),
    HeadingFeature({ enabledHeadingSizes: ["h2", "h3"] }),
    BoldFeature(),
    ItalicFeature(),
    UnderlineFeature(),
    LinkFeature({ enabledCollections: ["stories", "pages"] }),
    UnorderedListFeature(),
    OrderedListFeature(),
    BlockquoteFeature(),
    HorizontalRuleFeature(),
    UploadFeature({ collections: { media: { fields: [{ name: "caption", type: "text" }] } } }),
    FixedToolbarFeature(),
    InlineToolbarFeature(),
  ],
});
