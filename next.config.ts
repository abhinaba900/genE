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

export default withPayload(nextConfig, { devBundleServerPackages: false });
