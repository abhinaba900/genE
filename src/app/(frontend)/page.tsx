import { HomeView } from "@/components/home/HomeView";
import { getNavData } from "@/components/layout/getNavData";
import { getFeed, getHomepage, getStories } from "@/lib/content";

// Rendered on demand and cached; CMS changes invalidate it immediately (see cms/revalidate.ts).
export const revalidate = 60;

export default async function HomePage() {
  const [feed, home, stories, nav] = await Promise.all([getFeed(), getHomepage(), getStories(), getNavData()]);
  return <HomeView feed={feed} home={home} stories={stories} nav={nav} />;
}
