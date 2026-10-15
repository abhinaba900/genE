import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import type { Category, StorySummary } from "@/lib/content/types";

/** Topic tiles with a fan of story posters, used on the homepage and /categories. */
export function CategoryTiles({
  categories,
  stories,
  headingLevel = "h3",
  eager = 0,
}: {
  categories: Category[];
  stories: StorySummary[];
  headingLevel?: "h2" | "h3";
  /** How many leading tiles load their posters eagerly (those visible on first paint). */
  eager?: number;
}) {
  const Heading = headingLevel;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((c, i) => {
        const inCategory = stories.filter((s) => s.category.slug === c.slug);
        return (
          // Row-by-row stagger on the three-column grid.
          <Reveal as="li" key={c.slug} index={i % 3}>
            <article
              className="group relative flex h-full min-h-[220px] flex-col justify-between overflow-hidden rounded-2xl p-6 transition-transform duration-300 ease-out-soft active:scale-[0.99]"
              style={{ backgroundColor: c.tint }}
            >
              {/* Hover/focus wash: deepens the pastel without changing its hue. */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-ink/0 transition-colors duration-300 group-hover:bg-ink/[0.035] group-focus-within:bg-ink/[0.035]"
              />
              <div className="relative z-10 max-w-[60%]">
                <Heading className="font-serif text-[30px] leading-none tracking-[-0.02em] text-ink">
                  <Link href={`/category/${c.slug}`} className="after:absolute after:inset-0 after:rounded-2xl">
                    {c.name}
                  </Link>
                </Heading>
                <p className="mt-3 text-[14px] leading-relaxed text-ink/65">{c.description}</p>
              </div>
              <p className="relative z-10 mt-6 flex items-center gap-2 text-[13px] font-medium text-ink">
                {inCategory.length === 0 ? "Stories coming soon" : `${inCategory.length} ${inCategory.length === 1 ? "story" : "stories"}`}
                <span className="flex size-7 items-center justify-center rounded-full bg-ink/0 transition-colors duration-300 group-hover:bg-ink group-hover:text-white group-focus-within:bg-ink group-focus-within:text-white">
                  <ArrowUpRight
                    className="size-4 transition-transform duration-300 ease-out-soft group-hover:-translate-y-px group-hover:translate-x-px"
                    aria-hidden
                  />
                </span>
              </p>
              <div aria-hidden className="absolute right-3 bottom-5 top-5 flex items-center">
                {inCategory.slice(0, 3).map((s, j) => (
                  <div
                    key={s.id}
                    className="relative -ml-12 aspect-[9/16] h-[74%] overflow-hidden rounded-xl shadow-[0_10px_30px_rgb(0_0_0/0.18)] transition-[rotate,translate] duration-500 ease-out-soft first:ml-0 [rotate:var(--fan)] group-hover:-translate-y-1 group-hover:[rotate:var(--fan-open)]"
                    style={{ "--fan": `${(j - 1) * 5}deg`, "--fan-open": `${(j - 1) * 8}deg`, zIndex: 3 - j } as React.CSSProperties}
                  >
                    <Image
                      src={s.video.poster}
                      alt=""
                      fill
                      sizes="120px"
                      priority={i < eager}
                      className="object-cover transition-transform duration-700 ease-out-soft group-hover:scale-[1.05]"
                    />
                  </div>
                ))}
              </div>
            </article>
          </Reveal>
        );
      })}
    </ul>
  );
}
