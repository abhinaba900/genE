import type { Metadata } from "next";
import { Sidebar } from "@/components/layout/Sidebar";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { StoryRow } from "@/components/stories/StoryRow";
import { getCategories, getHighlights, getStories } from "@/lib/content";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Latest stories",
  description: "The newest gen.E stories — each one a short film with full reporting behind it.",
  alternates: { canonical: "/latest" },
};

export default async function LatestPage() {
  const [stories, highlights, categories] = await Promise.all([getStories(), getHighlights(5), getCategories()]);
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1680px] px-5 md:px-8 xl:px-12">
        <header className="border-b border-ink pb-8 pt-12 md:pt-16">
          <p className="kicker text-muted">Updated continuously</p>
          <h1 className="mt-4 font-serif text-display text-ink">Latest stories</h1>
        </header>
        <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_340px] xl:gap-20">
          <ol aria-label="Stories, newest first">
            {stories.map((s) => (
              <li key={s.id}>
                <StoryRow story={s} />
              </li>
            ))}
          </ol>
          <div className="hidden pt-8 lg:block">
            <Sidebar highlights={highlights} categories={categories} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
