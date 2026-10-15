"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

/** Feed URL for a category (`undefined` = "For you"). */
export function categoryHref(slug: string | undefined, basePath: "" | "/watch") {
  return slug ? (basePath ? `${basePath}/${slug}` : `/category/${slug}`) : basePath || "/";
}

/**
 * Horizontal discovery tabs over the reel ("For you" + categories).
 * `basePath` "" → "/" and "/category/:slug"; "/watch" → "/watch" and "/watch/:slug".
 */
export function CategorySelector({
  categories,
  active,
  basePath = "",
}: {
  categories: { slug: string; name: string }[];
  active?: string;
  basePath?: "" | "/watch";
}) {
  const listRef = useRef<HTMLUListElement>(null);
  const hrefFor = (slug?: string) => categoryHref(slug, basePath);

  // Keep the active tab in view when arriving on a category.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>("[aria-current='page']");
    el?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [active]);

  const items = [{ slug: undefined, name: "For you" }, ...categories];
  return (
    <nav aria-label="Story categories">
      <ul ref={listRef} className="flex gap-1 overflow-x-auto px-3 scrollbar-none [mask-image:linear-gradient(to_right,black_88%,transparent)]">
        {items.map((c) => {
          const isActive = c.slug === active;
          return (
            <li key={c.slug ?? "all"} className="shrink-0">
              <Link
                href={hrefFor(c.slug)}
                scroll={false}
                replace
                aria-current={isActive ? "page" : undefined}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  "relative flex h-10 items-center px-2.5 text-[15px] font-medium tracking-[-0.01em] transition-colors duration-200",
                  isActive ? "text-white" : "text-white/55 hover:text-white/85",
                )}
              >
                {c.name}
                <span
                  aria-hidden
                  className={cn(
                    "absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-accent transition-all duration-300",
                    isActive ? "scale-100 opacity-100" : "scale-0 opacity-0",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
