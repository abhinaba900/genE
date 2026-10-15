import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Category, StorySummary } from "@/lib/content/types";

/** Topic tiles with a fan of story posters, used on the homepage and /categories. */
export function CategoryTiles({
  categories,
  stories,
  headingLevel = "h3",
}: {
  categories: Category[];
  stories: StorySummary[];
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((c) => {
        const inCategory = stories.filter((s) => s.category.slug === c.slug);
        return (
          <li key={c.slug}>
            <article
              className="group relative flex h-full min-h-[220px] flex-col justify-between overflow-hidden rounded-2xl p-6"
              style={{ backgroundColor: c.tint }}
            >
              <div className="relative z-10 max-w-[60%]">
                <Heading className="font-serif text-[30px] leading-none tracking-[-0.02em] text-ink">
                  <Link href={`/category/${c.slug}`} className="after:absolute after:inset-0">
                    {c.name}
                  </Link>
                </Heading>
                <p className="mt-3 text-[14px] leading-relaxed text-ink/65">{c.description}</p>
              </div>
              <p className="relative z-10 mt-6 flex items-center gap-2 text-[13px] font-medium text-ink">
                {inCategory.length} {inCategory.length === 1 ? "story" : "stories"}
                <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
              </p>
              <div aria-hidden className="absolute right-3 bottom-5 top-5 flex items-center">
                {inCategory.slice(0, 3).map((s, i) => (
                  <div
                    key={s.id}
                    className="relative -ml-12 aspect-[9/16] h-[74%] overflow-hidden rounded-xl shadow-[0_10px_30px_rgb(0_0_0/0.18)] transition-transform duration-500 ease-out-soft first:ml-0 group-hover:-translate-y-1"
                    style={{ transform: `rotate(${(i - 1) * 5}deg)`, zIndex: 3 - i }}
                  >
                    <Image src={s.video.poster} alt="" fill sizes="120px" className="object-cover" />
                  </div>
                ))}
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
