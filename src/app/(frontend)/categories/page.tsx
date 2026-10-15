import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { CategoryTiles } from "@/components/stories/CategoryTiles";
import { getCategories, getStories } from "@/lib/content";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Categories",
  description: "Explore gen.E stories by topic.",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesPage() {
  const [categories, stories] = await Promise.all([getCategories(), getStories()]);
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto max-w-[1680px] px-5 md:px-8 xl:px-12">
        <header className="pb-10 pt-12 md:pt-16">
          <p className="enter kicker text-muted">Browse</p>
          <h1 className="enter mt-4 font-serif text-display text-ink [--step:1]">Explore by topic</h1>
          <p className="enter mt-4 max-w-xl text-[17px] leading-relaxed text-muted [--step:2]">
            Every category opens as a reel on your phone and as an editorial page on larger screens.
          </p>
        </header>
        <CategoryTiles categories={categories} stories={stories} headingLevel="h2" eager={2} />
      </main>
      <SiteFooter />
    </>
  );
}
