import { APIError, type CollectionConfig, type PayloadRequest, slugField } from "payload";
import { hasRole, isEditor, isStaff } from "../access";
import { recordAudit } from "../audit";
import { preventDeleteIfReferenced, revalidateOnChange, ensureUniqueSlug } from "../hooks";
import { TAGS, revalidate } from "../revalidate";

const revalidation = revalidateOnChange(TAGS.tags, TAGS.stories);

export const Tags: CollectionConfig = {
  slug: "tags",
  admin: {
    useAsTitle: "name",
    defaultColumns: ["name", "slug", "updatedAt"],
    group: "Content",
    description: "Search existing tags before creating new ones. Use “Merge” on a tag to fold duplicates together.",
    listSearchableFields: ["name", "slug"],
  },
  access: {
    read: () => true,
    // Authors can create tags while writing; only editors can rename, merge or delete them.
    create: isStaff,
    update: isEditor,
    delete: isEditor,
  },
  defaultSort: "name",
  fields: [
    { name: "name", type: "text", required: true, unique: true },
    slugField({ useAsSlug: "name", position: "sidebar" }),
    {
      name: "merge",
      type: "ui",
      admin: {
        position: "sidebar",
        components: { Field: "@/cms/admin/fields/TagMerge#TagMerge" },
        condition: (data) => Boolean(data?.id),
      },
    },
    {
      name: "stories",
      type: "join",
      collection: "stories",
      on: "tags",
      admin: { defaultColumns: ["title", "workflowStatus", "publishedAt"] },
    },
  ],
  endpoints: [
    {
      // POST /api/tags/:id/merge  { into: <tagId> } — moves every story to the target tag, then deletes this one.
      path: "/:id/merge",
      method: "post",
      handler: async (req) => {
        if (!hasRole(req, "admin", "editor")) return Response.json({ message: "Only editors can merge tags." }, { status: 403 });
        const sourceId = Number(req.routeParams?.id);
        const body = (await req.json?.()) as { into?: number | string } | undefined;
        const targetId = Number(body?.into);
        if (!sourceId || !targetId || sourceId === targetId) {
          return Response.json({ message: "Choose a different tag to merge into." }, { status: 400 });
        }
        const merged = await mergeTags(req, sourceId, targetId);
        return Response.json({ message: `Merged into “${merged.target}”. ${merged.moved} stories updated.`, ...merged });
      },
    },
  ],
  hooks: {
    beforeValidate: [ensureUniqueSlug("tags", "name")],
    beforeDelete: [preventDeleteIfReferenced([{ collection: "stories", field: "tags", label: "stories" }])],
    afterChange: [revalidation.afterChange],
    afterDelete: [revalidation.afterDelete],
  },
};

async function mergeTags(req: PayloadRequest, sourceId: number, targetId: number) {
  const [source, target] = await Promise.all([
    req.payload.findByID({ collection: "tags", id: sourceId, req, depth: 0 }),
    req.payload.findByID({ collection: "tags", id: targetId, req, depth: 0 }),
  ]).catch(() => {
    throw new APIError("Tag not found.", 404, undefined, true);
  });

  // Update the tag list on the live document and on the newest draft, without publishing anything.
  const affected = await req.payload.find({
    collection: "stories",
    where: { tags: { in: [sourceId] } },
    depth: 0,
    limit: 0,
    pagination: false,
    overrideAccess: true,
    trash: true,
    req,
    select: { tags: true },
  });

  for (const story of affected.docs) {
    const ids = new Set((story.tags ?? []).map((t) => (typeof t === "object" ? t.id : t)));
    ids.delete(sourceId);
    ids.add(targetId);
    await req.payload.db.updateOne({ collection: "stories", id: story.id, data: { tags: [...ids] }, req });
  }
  // Drafts and versions keep their own copy of the tag list.
  const versions = await req.payload.db.findVersions({
    collection: "stories",
    where: { "version.tags": { in: [sourceId] } },
    limit: 0,
    pagination: false,
    req,
  });
  for (const v of versions.docs) {
    const tags = (v.version as { tags?: (number | { id: number })[] }).tags ?? [];
    const ids = new Set(tags.map((t) => (typeof t === "object" ? t.id : t)));
    ids.delete(sourceId);
    ids.add(targetId);
    await req.payload.db.updateVersion({
      collection: "stories",
      id: v.id,
      versionData: { ...v, version: { ...(v.version as object), tags: [...ids] } } as never,
      req,
    });
  }

  await req.payload.delete({ collection: "tags", id: sourceId, overrideAccess: true, req });
  await recordAudit(req, { action: "merged", collection: "tags", docId: targetId, title: target.name, note: `Merged “${source.name}” into “${target.name}”` });
  revalidate(TAGS.tags, TAGS.stories);
  return { moved: affected.docs.length, target: target.name };
}
