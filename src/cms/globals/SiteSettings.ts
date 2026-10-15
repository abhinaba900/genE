import type { GlobalConfig } from "payload";
import { isAdmin } from "../access";
import { validateHttpUrl } from "../collections/Authors";
import { TAGS, revalidate } from "../revalidate";

/**
 * Public-facing site configuration. Secrets (database, storage keys, SMTP) never live
 * here — they belong in server environment variables.
 */
export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  label: "Site settings",
  admin: { group: "Website" },
  access: { read: () => true, update: isAdmin },
  fields: [
    {
      type: "tabs",
      tabs: [
        {
          label: "Identity",
          fields: [
            { name: "siteName", type: "text", required: true, defaultValue: "gen.E" },
            { name: "tagline", type: "text", defaultValue: "Watch the story. Explore the details." },
            { name: "description", type: "textarea", label: "Website description" },
            {
              type: "row",
              fields: [
                { name: "logo", type: "upload", relationTo: "media", admin: { width: "50%", description: "Optional. The text wordmark is used when empty." } },
                { name: "favicon", type: "upload", relationTo: "media", admin: { width: "50%", description: "Square PNG, at least 192×192." } },
              ],
            },
            { name: "contactEmail", type: "email" },
            {
              name: "socials",
              type: "array",
              label: "Social media",
              fields: [
                {
                  type: "row",
                  fields: [
                    {
                      name: "platform",
                      type: "select",
                      required: true,
                      options: ["YouTube", "Instagram", "X", "LinkedIn", "Facebook", "Threads", "WhatsApp"].map((p) => ({ label: p, value: p.toLowerCase() })),
                      admin: { width: "35%" },
                    },
                    { name: "url", type: "text", required: true, validate: validateHttpUrl, admin: { width: "65%" } },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: "SEO defaults",
          fields: [
            { name: "defaultTitle", type: "text", label: "Default SEO title" },
            { name: "defaultDescription", type: "textarea", label: "Default meta description" },
            { name: "defaultShareImage", type: "upload", relationTo: "media", label: "Default sharing image" },
          ],
        },
        {
          label: "Footer",
          fields: [
            { name: "footerText", type: "text", defaultValue: "Films and stories by gen.E." },
            { name: "copyright", type: "text", defaultValue: "gen.E", admin: { description: "Shown as “© {year} {copyright}”." } },
          ],
        },
      ],
    },
  ],
  hooks: {
    afterChange: [
      ({ doc }) => {
        revalidate(TAGS.settings, TAGS.navigation);
        return doc;
      },
    ],
  },
};
