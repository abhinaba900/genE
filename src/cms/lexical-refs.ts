/** Collect every media id a story or page references, so the media library can tell what is in use. */
export function collectMediaRefs(data: Record<string, any>): number[] {
  const ids = new Set<number>();
  const add = (value: unknown) => {
    const id = typeof value === "object" && value ? (value as { id?: unknown }).id : value;
    if (typeof id === "number" || (typeof id === "string" && /^\d+$/.test(id))) ids.add(Number(id));
  };

  add(data.featuredImage);
  add(data.seo?.image);
  add(data.heroImage);

  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    const n = node as Record<string, any>;
    if (n.type === "upload" && n.relationTo === "media") add(n.value);
    for (const value of Object.values(n)) if (value && typeof value === "object") walk(value);
  };
  walk(data.content);
  walk(data.layout);
  return [...ids];
}
