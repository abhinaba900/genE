import { SITE_URL } from "@/lib/site";

/**
 * Preview URLs open a route on the public site that checks the CMS session
 * before showing unpublished content (see `app/(frontend)/preview`).
 */
export function previewUrl(collection: "stories" | "pages", id?: number | string | null) {
  if (!id) return null;
  return `${SITE_URL}/preview/${collection}/${id}`;
}

export const livePreviewBreakpoints = [
  { label: "Mobile", name: "mobile", width: 390, height: 844 },
  { label: "Tablet", name: "tablet", width: 820, height: 1180 },
  { label: "Desktop", name: "desktop", width: 1440, height: 900 },
];
