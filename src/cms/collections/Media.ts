import { APIError, type CollectionConfig } from "payload";
import { isEditor, isStaff, staffUser } from "../access";
import { revalidateOnChange } from "../hooks";
import { TAGS } from "../revalidate";
import { IMAGE_MAX_BYTES } from "../storage";

const revalidation = revalidateOnChange(TAGS.stories, TAGS.pages, TAGS.settings, TAGS.authors, TAGS.categories);

/**
 * Images and caption files. Videos live in their own collection (see Videos) because
 * they have a different pipeline and metadata.
 */
export const Media: CollectionConfig = {
  slug: "media",
  labels: { singular: "Image or file", plural: "Media library" },
  admin: {
    group: "Media",
    useAsTitle: "filename",
    defaultColumns: ["filename", "alt", "mimeType", "filesize", "updatedAt"],
    listSearchableFields: ["filename", "alt", "caption"],
    description: "Images and caption files. Reuse them across stories; files still in use can't be deleted.",
  },
  access: {
    read: () => true,
    create: isStaff,
    // Authors may fix alt text on images they uploaded; editors manage everything.
    update: ({ req }) => {
      const user = staffUser(req);
      if (!user) return false;
      if (user.role === "admin" || user.role === "editor") return true;
      return { uploadedBy: { equals: user.id } };
    },
    delete: isEditor,
  },
  upload: {
    mimeTypes: ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "text/vtt"],
    focalPoint: true,
    adminThumbnail: "thumbnail",
    imageSizes: [
      { name: "thumbnail", width: 400, withoutEnlargement: true },
      { name: "og", width: 1200, height: 630, position: "centre", withoutEnlargement: false },
    ],
  },
  fields: [
    {
      name: "alt",
      type: "text",
      label: "Alt text",
      admin: { description: "Describe the image for people who can't see it. Required for images." },
      validate: (value: unknown, { siblingData }: { siblingData: { mimeType?: string } }) =>
        siblingData?.mimeType?.startsWith("image/") && !String(value ?? "").trim() ? "Add alt text so the image is accessible." : true,
    },
    { name: "caption", type: "textarea", admin: { description: "Default caption when the image is placed in an article." } },
    { name: "credit", type: "text", admin: { description: "Photographer or source, e.g. “gen.E”." } },
    {
      name: "uploadedBy",
      type: "relationship",
      relationTo: "users",
      admin: { readOnly: true, position: "sidebar" },
      access: { update: () => false },
    },
    {
      name: "usedIn",
      type: "join",
      collection: "stories",
      on: "mediaRefs",
      label: "Used in stories",
      admin: { defaultColumns: ["title", "workflowStatus"] },
    },
    {
      name: "usedInPages",
      type: "join",
      collection: "pages",
      on: "mediaRefs",
      label: "Used in pages",
      admin: { defaultColumns: ["title", "_status"] },
    },
  ],
  hooks: {
    beforeChange: [
      ({ data, operation, req }) => {
        if (operation === "create") data.uploadedBy = staffUser(req)?.id;
        if (typeof data.filesize === "number" && data.filesize > IMAGE_MAX_BYTES) {
          throw new APIError(`Images can be at most ${Math.round(IMAGE_MAX_BYTES / 1024 / 1024)} MB.`, 413, undefined, true);
        }
        return data;
      },
    ],
    beforeDelete: [preventDeletingMediaInUse],
    afterChange: [revalidation.afterChange],
    afterDelete: [revalidation.afterDelete],
  },
};

async function preventDeletingMediaInUse({ id, req }: { id: number | string; req: import("payload").PayloadRequest }) {
  const checks = [
    { collection: "stories", where: { mediaRefs: { in: [id] } }, label: "stories" },
    { collection: "pages", where: { mediaRefs: { in: [id] } }, label: "pages" },
    { collection: "videos", where: { or: [{ poster: { equals: id } }, { captions: { equals: id } }] }, label: "videos" },
    { collection: "authors", where: { photo: { equals: id } }, label: "author profiles" },
    { collection: "categories", where: { image: { equals: id } }, label: "categories" },
  ] as const;
  const uses: string[] = [];
  for (const check of checks) {
    const { totalDocs } = await req.payload.count({ collection: check.collection, where: check.where as never, overrideAccess: true, req });
    if (totalDocs) uses.push(`${totalDocs} ${check.label}`);
  }
  const settings = await req.payload.findGlobal({ slug: "site-settings", depth: 0, overrideAccess: true, req });
  const settingsRefs = [settings.logo, settings.favicon, settings.defaultShareImage].map((v) => (typeof v === "object" && v ? v.id : v));
  if (settingsRefs.includes(Number(id))) uses.push("site settings");
  if (uses.length) throw new APIError(`This file is still used by ${uses.join(", ")}. Replace it there first.`, 409, undefined, true);
}
