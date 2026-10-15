import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HomeView } from "@/components/home/HomeView";
import { getNavData } from "@/components/layout/getNavData";
import { PreviewBar } from "@/components/preview/PreviewBar";
import { getStories } from "@/lib/content";
import { getPreviewHomepage, previewUser } from "@/lib/content/payload/preview";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Homepage preview", robots: { index: false, follow: false } };

/** The homepage and mobile feed built from the *draft* Homepage & Feed settings. */
export default async function HomePreview() {
  if (!(await previewUser())) redirect(`/admin/login?redirect=${encodeURIComponent("/preview/home")}`);
  const [{ home, feed }, stories, nav] = await Promise.all([getPreviewHomepage(), getStories(), getNavData()]);
  return (
    <>
      <HomeView feed={feed} home={home} stories={stories} nav={nav} />
      <PreviewBar label="draft homepage & feed" editHref="/admin/globals/homepage" />
    </>
  );
}
