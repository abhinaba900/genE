export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const SITE_NAME = "gen.E";

export function absoluteUrl(path = "/") {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export const storyPath = (slug: string) => `/stories/${slug}`;
export const categoryPath = (slug: string) => `/category/${slug}`;
/** Reel URL (works on every screen size), optionally positioned on a story. */
export const watchPath = (slug?: string, category?: string) => {
  const base = category ? `/watch/${category}` : "/watch";
  return slug ? `${base}?story=${encodeURIComponent(slug)}` : base;
};

/** Default social preview (1200×630). Overridden by Site settings → Default sharing image, and per story/page. */
export const DEFAULT_SHARE_IMAGE = { url: "/brand/og-default.jpg", width: 1200, height: 630, alt: "gen.E — Sustainable stories of companies in India" };

export function shareImage(image?: { src: string; width: number; height: number; alt?: string }) {
  return image ? { url: image.src, width: image.width, height: image.height, alt: image.alt ?? "" } : DEFAULT_SHARE_IMAGE;
}
