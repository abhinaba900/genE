import {
  APIError,
  type CollectionAfterChangeHook,
  type CollectionAfterDeleteHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionBeforeValidateHook,
  type CollectionSlug,
  type Where,
} from "payload";
import { type CacheTag, revalidate } from "./revalidate";

interface Reference {
  collection: CollectionSlug;
  /** Field path holding the relationship (hasOne or hasMany). */
  field: string;
  label: string;
}

/**
 * Refuse to delete a record that other content still points at — e.g. a category
 * that stories use, or an image on a published story. The editor gets a clear
 * message naming what to reassign first.
 */
export function preventDeleteIfReferenced(references: Reference[]): CollectionBeforeDeleteHook {
  return async ({ id, req }) => {
    const problems: string[] = [];
    for (const ref of references) {
      const where: Where = { [ref.field]: { in: [id] } };
      const { totalDocs } = await req.payload.count({ collection: ref.collection, where, overrideAccess: true, req, trash: true });
      if (totalDocs > 0) problems.push(`${totalDocs} ${ref.label}`);
    }
    if (problems.length) {
      throw new APIError(`Still in use by ${problems.join(", ")}. Reassign or remove those references first.`, 409, undefined, true);
    }
  };
}

/**
 * Keep a list of retired slugs so renamed stories, categories and pages keep
 * working: the public site permanently redirects an old slug to the current one.
 */
export const trackPreviousSlugs: CollectionBeforeChangeHook = ({ data, originalDoc, operation }) => {
  if (operation !== "update" || !originalDoc?.slug || !data.slug || data.slug === originalDoc.slug) return data;
  const previous = new Set<string>([...(originalDoc.previousSlugs ?? []), originalDoc.slug]);
  previous.delete(data.slug);
  data.previousSlugs = [...previous].slice(-20);
  return data;
};

export function revalidateOnChange(...tags: CacheTag[]): {
  afterChange: CollectionAfterChangeHook;
  afterDelete: CollectionAfterDeleteHook;
} {
  return {
    afterChange: ({ doc }) => {
      revalidate(...tags);
      return doc;
    },
    afterDelete: ({ doc }) => {
      revalidate(...tags);
      return doc;
    },
  };
}

/**
 * Server-side slug generation (the admin UI also generates slugs, but API, seed and
 * scripted writes must not depend on it). Fills an empty slug from `source`, normalises
 * it, and appends -2, -3… until it is unique — so duplicates never reach the database.
 */
export function ensureUniqueSlug(collection: CollectionSlug, source: string): CollectionBeforeValidateHook {
  return async ({ data, originalDoc, req }) => {
    if (!data) return data;
    const raw = data.slug || originalDoc?.slug || data[source] || originalDoc?.[source];
    const base = raw ? slugify(String(raw)) : "";
    if (!base) {
      data.slug = null;
      return data;
    }
    let candidate = base;
    for (let n = 2; n < 200; n++) {
      const clash = await req.payload.find({
        collection,
        where: { and: [{ slug: { equals: candidate } }, ...(originalDoc?.id ? [{ id: { not_equals: originalDoc.id } }] : [])] },
        limit: 1,
        depth: 0,
        select: {},
        overrideAccess: true,
        trash: true,
        req,
      } as never);
      if (!clash.docs.length) break;
      candidate = `${base}-${n}`;
    }
    data.slug = candidate;
    return data;
  };
}

/** Lower-case, ASCII, hyphenated. Used for slugs generated outside the slug field (e.g. tags created inline). */
export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

export const previousSlugsField = {
  name: "previousSlugs",
  type: "text" as const,
  hasMany: true,
  index: true,
  label: "Previous URLs",
  admin: {
    readOnly: true,
    position: "sidebar" as const,
    description: "Old slugs that now redirect here. Recorded automatically when the slug changes.",
    condition: (data: { previousSlugs?: string[] }) => Boolean(data?.previousSlugs?.length),
  },
};
