import type { Field, GlobalConfig } from "payload";
import { isEditor } from "../access";
import { TAGS, revalidate } from "../revalidate";

const linkList = (name: string, label: string, description: string): Field => ({
  name,
  type: "array",
  label,
  admin: { description, initCollapsed: false },
  labels: { singular: "Link", plural: "Links" },
  fields: [
    {
      type: "row",
      fields: [
        { name: "label", type: "text", required: true, admin: { width: "40%" } },
        {
          name: "href",
          type: "text",
          required: true,
          admin: { width: "60%", description: "/latest, /category/environment or https://…" },
          validate: (v: unknown) => (/^(\/|https:\/\/|mailto:)/.test(String(v ?? "")) ? true : "Start with /, https:// or mailto:"),
        },
      ],
    },
  ],
});

export const Navigation: GlobalConfig = {
  slug: "navigation",
  label: "Navigation",
  admin: { group: "Website", description: "Category links are added to the menus automatically from enabled categories." },
  access: { read: () => true, update: isEditor },
  fields: [
    linkList("primary", "Primary navigation", "Main links in the header and drawer."),
    linkList("secondary", "Secondary navigation", "About, contact and similar links."),
    linkList("legal", "Legal links", "Shown in the footer."),
  ],
  hooks: {
    afterChange: [
      ({ doc }) => {
        revalidate(TAGS.navigation);
        return doc;
      },
    ],
  },
};
