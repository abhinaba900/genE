import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const cdn = process.env.BUNNY_CDN_URL ? new URL(process.env.BUNNY_CDN_URL) : null;

const nextConfig: NextConfig = {
  // Dev-only badge; bottom-left would sit on top of the CMS sidebar's user card.
  devIndicators: { position: "bottom-right" },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 480, 640, 768, 1024, 1280, 1600],
    imageSizes: [64, 96, 128, 200, 280, 400],
    // CMS media is served from the storage CDN (Bunny pull zone).
    remotePatterns: cdn ? [{ protocol: cdn.protocol.replace(":", "") as "https" | "http", hostname: cdn.hostname }] : [],
    // Local-storage fallback serves files through Payload's API.
    localPatterns: [{ pathname: "/media/**" }, { pathname: "/api/media/file/**" }, { pathname: "/brand/**" }],
  },
  async headers() {
    return [
      {
        source: "/media/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
      {
        // The CMS is never cached by shared caches and never framed by other sites.
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

const config = withPayload(nextConfig, { devBundleServerPackages: false });

/*
 * withPayload adds `Accept-CH` / `Critical-CH: Sec-CH-Prefers-Color-Scheme` to every route so the
 * admin can pick its theme server-side. `Critical-CH` makes the browser re-request any page that
 * arrives without that hint — a ~600 ms extra round trip on every first visit (Lighthouse:
 * "Avoid multiple page redirects"). Only the admin needs it, so scope that header set to /admin.
 */
const payloadHeaders = config.headers;
config.headers = async () => {
  const rules = (await payloadHeaders?.()) ?? [];
  return rules.map((rule) =>
    rule.source === "/:path*" && rule.headers.some((h) => h.key === "Critical-CH")
      ? { ...rule, source: "/admin/:path*" }
      : rule,
  );
};

export default config;
