import type { Metadata, Viewport } from "next";
import { Geist, Newsreader } from "next/font/google";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { getSiteSettings } from "@/lib/content";
import { SITE_NAME, SITE_URL, shareImage } from "@/lib/site";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  style: ["normal", "italic"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const name = settings.name || SITE_NAME;
  const description =
    settings.defaultDescription ||
    settings.description ||
    "gen.E is a video-first news platform. Discover stories through short vertical films, then explore the full reporting.";
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: settings.defaultTitle || `${name} — ${settings.tagline || "Watch the story. Explore the details."}`, template: `%s · ${name}` },
    description,
    applicationName: name,
    openGraph: {
      type: "website",
      siteName: name,
      locale: "en_GB",
      images: [shareImage(settings.defaultShareImage)],
    },
    twitter: { card: "summary_large_image", images: [shareImage(settings.defaultShareImage).url] },
    alternates: { canonical: "/" },
    appleWebApp: { capable: true, title: name, statusBarStyle: "black-translucent" },
    formatDetection: { telephone: false },
    icons: settings.favicon ? { icon: settings.favicon } : undefined,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(max-width: 767px)", color: "#050505" },
    { color: "#f6f4ef" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${geist.variable} ${newsreader.variable}`}>
      <body className="min-h-dvh"  cz-shortcut-listen="true">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Skip to content
        </a>
        {/* Scroll reveals start hidden; without JavaScript, show everything. */}
        <noscript>
          <style>{"[data-reveal]{opacity:1!important;transform:none!important;clip-path:none!important}"}</style>
        </noscript>
        <MotionProvider>{children}</MotionProvider>
        <SmoothScroll />
      </body>
    </html>
  );
}
