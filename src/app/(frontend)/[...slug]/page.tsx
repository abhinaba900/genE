import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { PageView } from "@/components/page/PageView";
import { getPage } from "@/lib/content";
import { shareImage, SITE_NAME } from "@/lib/site";

/**
 * CMS pages (About, Contact, Privacy, Terms and any page editors add).
 * Static routes such as /latest or /stories take precedence over this catch-all.
 */
type Params = { slug: string[] };

export const revalidate = 60;

async function load(segments: string[]) {
  // Pages are single-level (/about); anything deeper is not a page.
  if (segments.length !== 1) return { page: null };
  return getPage(decodeURIComponent(segments[0]));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { page } = await load((await params).slug);
  if (!page) return { title: "Page not found", robots: { index: false } };
  return {
    title: page.seo?.title || page.title,
    description: page.seo?.description || page.intro,
    alternates: { canonical: `/${page.slug}` },
    robots: page.seo?.noIndex ? { index: false, follow: true } : undefined,
    openGraph: {
      siteName: SITE_NAME,
      title: page.seo?.title || page.title,
      description: page.seo?.description || page.intro,
      url: `/${page.slug}`,
      images: [shareImage(page.seo?.image ?? page.heroImage)],
    },
    twitter: { card: "summary_large_image", images: [shareImage(page.seo?.image ?? page.heroImage).url] },
  };
}

export default async function CmsPage({ params }: { params: Promise<Params> }) {
  const { page, redirect } = await load((await params).slug);
  if (!page) {
    if (redirect) permanentRedirect(`/${redirect}`);
    notFound();
  }
  return <PageView page={page} />;
}
