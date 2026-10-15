import Link from "next/link";
import { StoryCard } from "@/components/stories/StoryCard";
import type { Category, Highlights, StorySummary } from "@/lib/content/types";
import { storyPath } from "@/lib/site";

/** Editorial sidebar: latest, highlights (real trending or editor's picks), topics and about links. */
export function Sidebar({
  latest,
  highlights,
  categories,
}: {
  latest?: StorySummary[];
  highlights: Highlights;
  categories: Category[];
}) {
  const trending = highlights.stories;
  return (
    <aside aria-label="More from gen.E" className="space-y-12">
      {latest && latest.length > 0 && (
        <section aria-labelledby="sidebar-latest">
          <SidebarHeading id="sidebar-latest">Just in</SidebarHeading>
          <ul className="mt-5 space-y-5">
            {latest.map((s) => (
              <li key={s.id}>
                <StoryCard story={s} variant="compact" as="h3" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {trending.length > 0 && (
      <section aria-labelledby="sidebar-trending">
        <SidebarHeading id="sidebar-trending">{highlights.heading}</SidebarHeading>
        <ol className="mt-3">
          {trending.map((s, i) => (
            <li key={s.id} className="group relative flex gap-4 border-b border-line py-4 last:border-0">
              <span aria-hidden className="w-6 shrink-0 font-serif text-[26px] italic leading-none text-accent">
                {i + 1}
              </span>
              <div>
                <p className="kicker text-ink/50">{s.category.name}</p>
                <h3 className="mt-1.5 font-serif text-[17px] leading-snug text-ink">
                  <Link href={storyPath(s.slug)} className="after:absolute after:inset-0 group-hover:underline group-hover:decoration-1 group-hover:underline-offset-4">
                    {s.title}
                  </Link>
                </h3>
              </div>
            </li>
          ))}
        </ol>
      </section>
      )}

      <section aria-labelledby="sidebar-topics">
        <SidebarHeading id="sidebar-topics">Topics</SidebarHeading>
        <ul className="mt-5 flex flex-wrap gap-2">
          {categories.map((c) => (
            <li key={c.slug}>
              <Link
                href={`/category/${c.slug}`}
                className="inline-flex min-h-10 items-center rounded-full px-4 text-[13px] text-ink transition-[filter] hover:brightness-95"
                style={{ backgroundColor: c.tint }}
              >
                {c.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="sidebar-about" className="rounded-2xl bg-ink p-6 text-white">
        <h2 id="sidebar-about" className="font-serif text-[24px] leading-tight">
          Watch the story. <em>Explore the details.</em>
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-white/65">
          Every gen.E story starts as a short film and opens into full reporting.
        </p>
        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
          <li><Link href="/about" className="inline-flex min-h-9 items-center underline-offset-4 hover:underline">About gen.E</Link></li>
          <li><Link href="/contact" className="inline-flex min-h-9 items-center underline-offset-4 hover:underline">Contact</Link></li>
          <li><Link href="/watch" className="inline-flex min-h-9 items-center underline-offset-4 hover:underline">Watch the reel</Link></li>
        </ul>
      </section>
    </aside>
  );
}

function SidebarHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="kicker flex items-center gap-3 text-ink">
      {children}
      <span aria-hidden className="h-px flex-1 bg-line" />
    </h2>
  );
}
