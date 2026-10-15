"use client";

import { Loader2, Search, X } from "lucide-react";
import { m } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StoryRow } from "@/components/stories/StoryRow";
import { EmptyState } from "@/components/ui/EmptyState";
import type { StorySummary } from "@/lib/content/types";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { watchPath } from "@/lib/site";
import { EASE, STAGGER } from "@/components/motion/tokens";

const DEBOUNCE_MS = 220;

/**
 * Instant search over /api/search. Server-renders initial results for `?q=`,
 * and the form still submits normally (GET /search?q=) without JavaScript.
 */
export function SearchInterface({
  initialQuery,
  initialResults,
  suggestions,
}: {
  initialQuery: string;
  initialResults: StorySummary[];
  suggestions: { label: string; query: string }[];
}) {
  const [query, setQuery] = useState(initialQuery);
  // Phones & tablets (same breakpoint as the search sheet): results open as a reel.
  // Server render / no-JS falls back to the article link.
  const openInReel = useMediaQuery("(max-width: 1023px)");
  const [results, setResults] = useState(initialResults);
  const [settledQuery, setSettledQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const first = useRef(true);

  useEffect(() => {
    if (!initialQuery) input.current?.focus();
  }, [initialQuery]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const q = query.trim();
    const url = q ? `/search?q=${encodeURIComponent(q)}` : "/search";
    window.history.replaceState(window.history.state, "", url);
    if (!q) {
      setResults([]);
      setSettledQuery("");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) throw new Error(String(res.status));
        const data: { results: StorySummary[] } = await res.json();
        setResults(data.results);
        setSettledQuery(q);
        setFailed(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const hasQuery = settledQuery.length > 0;

  return (
    <div>
      <form action="/search" role="search" onSubmit={(e) => {
          // Results are already live; just dismiss the on-screen keyboard.
          e.preventDefault();
          input.current?.blur();
        }} className="relative">
        <label htmlFor="search-input" className="sr-only">
          Search stories
        </label>
        <Search className="pointer-events-none absolute left-0 top-1/2 size-6 -translate-y-1/2 text-ink/40 md:size-8" strokeWidth={1.6} aria-hidden />
        <input
          ref={input}
          id="search-input"
          name="q"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search stories, topics, tags…"
          autoComplete="off"
          enterKeyHint="search"
          className="h-20 w-full border-b-2 border-ink bg-transparent pl-10 pr-12 font-serif transition-shadow duration-200 focus:shadow-[0_2px_0_0_var(--color-ink)] text-[28px] tracking-[-0.01em] text-ink placeholder:text-ink/30 focus:outline-none md:h-24 md:pl-14 md:text-[44px] [&::-webkit-search-cancel-button]:hidden"
        />
        <span className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center">
          {loading ? (
            <Loader2 className="size-5 animate-spin text-muted" aria-label="Searching" />
          ) : (
            query && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  input.current?.focus();
                }}
                aria-label="Clear search"
                className="flex size-11 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5 hover:text-ink"
              >
                <X className="size-5" />
              </button>
            )
          )}
        </span>
      </form>

      <div aria-live="polite" className="sr-only">
        {hasQuery && !loading ? `${results.length} ${results.length === 1 ? "result" : "results"} for ${settledQuery}` : ""}
      </div>

      {!hasQuery && (
        <section aria-labelledby="suggestions" className="mt-10">
          <h2 id="suggestions" className="kicker text-muted">
            Try searching for
          </h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <li key={s.query}>
                <Link
                  href={`/search?q=${encodeURIComponent(s.query)}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setQuery(s.query);
                  }}
                  className="inline-flex min-h-11 items-center rounded-full px-4 text-[14px] text-ink ring-1 ring-ink/15 transition-colors hover:bg-ink hover:text-white"
                >
                  {s.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {failed && (
        <p role="alert" className="mt-8 rounded-xl bg-paper-2 px-5 py-4 text-[14px] text-ink">
          Search is temporarily unavailable. Please try again in a moment.
        </p>
      )}

      {hasQuery && (
        <section aria-labelledby="results-heading" className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <h2 id="results-heading" className="mt-8 text-[14px] text-muted">
            {results.length} {results.length === 1 ? "result" : "results"} for{" "}
            <span className="text-ink">“{settledQuery}”</span>
          </h2>
          {results.length === 0 ? (
            <EmptyState
              title="Nothing matches that search."
              description="Try a broader word, a category like “Culture”, or a topic such as “energy”."
              action={{ label: "Browse latest stories", href: "/latest" }}
            />
          ) : (
            <ol className="mt-2">
              {results.map((s, i) => (
                // Keyed by story: rows that stay between queries don't re-animate, new ones lift in.
                <m.li
                  key={s.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: EASE, delay: Math.min(i, 5) * (STAGGER / 2) }}
                >
                  <StoryRow
                    story={s}
                    as="h3"
                    highlight={settledQuery}
                    href={openInReel ? `${watchPath(s.slug)}&play=1` : undefined}
                  />
                </m.li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  );
}
