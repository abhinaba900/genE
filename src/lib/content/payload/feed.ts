import type { StorySummary } from "../types";

export type Ordering = "latest" | "featured_first" | "curated";
export const ids = (list: unknown[] | null | undefined) =>
  (list ?? []).map((v) => String(typeof v === "object" && v ? (v as { id: number }).id : v));

/** Deterministic: pinned (in order) → rule → newest first, ties by id. Hidden-from-feed stories are excluded. */
export function orderFeed(stories: StorySummary[], ordering: Ordering, pinned: string[], curated: string[]): StorySummary[] {
  const byId = new Map(stories.map((s) => [s.id, s]));
  const taken = new Set<string>();
  const out: StorySummary[] = [];
  const take = (id: string) => {
    const s = byId.get(id);
    if (s && !taken.has(id)) {
      taken.add(id);
      out.push(s);
    }
  };
  pinned.forEach(take);
  if (ordering === "curated") curated.forEach(take);
  if (ordering === "featured_first") stories.filter((s) => s.featured).forEach((s) => take(s.id));
  stories.forEach((s) => take(s.id));
  return out;
}
