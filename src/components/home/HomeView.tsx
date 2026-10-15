import { VideoFeed } from "@/components/feed/VideoFeed";
import { toFeedStory } from "@/components/feed/types";
import { Sidebar } from "@/components/layout/Sidebar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { JsonLd, websiteJsonLd } from "@/components/seo/JsonLd";
import { CategoryTiles } from "@/components/stories/CategoryTiles";
import { FeaturedStory } from "@/components/stories/FeaturedStory";
import { StoryCard } from "@/components/stories/StoryCard";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { Homepage, StorySummary } from "@/lib/content";
import type { NavData } from "@/components/layout/nav";

/**
 * Home.
 * Mobile  → the immersive reel feed is the homepage.
 * Desktop → an editorial video magazine.
 * Both are server-rendered; the inactive layout is hidden with CSS and stays dormant (no video loads).
 * Shared by the live homepage and the CMS draft preview.
 */
export function HomeView({ feed, home, stories, nav }: { feed: StorySummary[]; home: Homepage; stories: StorySummary[]; nav: NavData }) {
  const { featured, reels, latest, highlights, topics } = home;
  const [lead, ...rest] = latest;

  return (
    <>
      <JsonLd data={websiteJsonLd()} />
      {/* `contents` keeps the header sticky relative to the page, not this wrapper. */}
      <div className="hidden md:contents">
        <SiteHeader />
      </div>
      <main id="main">
        {/* ── Mobile: reel feed ── */}
        <div className="md:hidden">
          <h1 className="sr-only">gen.E — today’s stories</h1>
          <VideoFeed stories={feed.map(toFeedStory)} nav={nav} />
        </div>

        {/* ── Desktop: editorial homepage ── */}
        <div className="mx-auto hidden max-w-[1680px] px-8 md:block xl:px-12">
          {featured && (
            <div className="py-14 lg:py-20">
              <FeaturedStory story={featured} />
            </div>
          )}

          <section aria-labelledby="reels-heading" className="pt-6">
            <SectionHeading
              id="reels-heading"
              kicker="In motion"
              title="Today’s reels"
              link={{ label: "Open the reel", href: "/watch" }}
            />
            <ul className="mt-8 grid grid-cols-3 gap-5 lg:grid-cols-5">
              {reels.map((s, i) => (
                <li key={s.id} className={i > 2 ? "hidden lg:block" : undefined}>
                  <StoryCard story={s} variant="reel" />
                </li>
              ))}
            </ul>
          </section>

          <div className="mt-24 grid gap-14 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-20">
            <section aria-labelledby="latest-heading">
              <SectionHeading
                id="latest-heading"
                kicker="Fresh from the newsroom"
                title="Latest stories"
                link={{ label: "View all stories", href: "/latest" }}
              />
              {lead && <StoryCard story={lead} variant="wide" className="mt-8" />}
              <ul className="mt-6 grid gap-6 sm:grid-cols-2">
                {rest.map((s) => (
                  <li key={s.id} className="h-full">
                    <StoryCard story={s} variant="panel" className="h-full" />
                  </li>
                ))}
              </ul>
            </section>
            <div className="lg:pt-[76px]">
              <Sidebar highlights={highlights} categories={topics} />
            </div>
          </div>

          <section aria-labelledby="topics-heading" className="mt-24">
            <SectionHeading
              id="topics-heading"
              kicker="Browse"
              title="Explore by topic"
              link={{ label: "All categories", href: "/categories" }}
            />
            <div className="mt-8">
              <CategoryTiles categories={topics} stories={stories} />
            </div>
          </section>
        </div>
      </main>
      <div className="hidden md:block">
        <SiteFooter />
      </div>
    </>
  );
}
