import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SearchInterface } from "@/components/search/SearchInterface";
import { getCategories, getStories, searchStories } from "@/lib/content";

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ q?: string }> }): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: q ? `Search: ${q}` : "Search",
    description: "Search gen.E stories by title, topic, category or tag.",
    alternates: { canonical: "/search" },
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const raw = (await searchParams).q;
  const query = (Array.isArray(raw) ? raw[0] : raw ?? "").trim().slice(0, 120);
  const [results, categories, stories] = await Promise.all([
    query ? searchStories(query) : Promise.resolve([]),
    getCategories(),
    getStories(),
  ]);

  // Suggest categories plus the most common tags.
  const tagCounts = new Map<string, number>();
  stories.forEach((s) => s.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1)));
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);
  const suggestions = [
    ...categories.map((c) => ({ label: c.name, query: c.name })),
    ...topTags.map((t) => ({ label: `#${t}`, query: t })),
  ];

  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto min-h-[60vh] max-w-[960px] px-5 pt-10 md:px-8 md:pt-16">
        <h1 className="enter kicker text-muted">Search gen.E</h1>
        <div className="enter mt-4 [--step:1]">
          <SearchInterface key={query} initialQuery={query} initialResults={results} suggestions={suggestions} />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
