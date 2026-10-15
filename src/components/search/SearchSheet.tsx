"use client";

import { AnimatePresence, LazyMotion, domAnimation, m, useDragControls } from "motion/react";
import { ArrowUpRight, Clock, Play, Search, TrendingUp, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { NavData } from "@/components/layout/nav";
import { Highlight } from "@/components/ui/Highlight";
import { cn } from "@/lib/cn";
import type { StorySummary } from "@/lib/content/types";
import { formatDuration } from "@/lib/format";
import { useMediaQuery } from "@/lib/hooks/useMediaQuery";
import { requestOpenStory, setOverlayOpen } from "@/lib/overlay";
import { watchPath } from "@/lib/site";

const RECENT_KEY = "gen-e:recent-searches";
const MAX_RECENT = 6;
const DEBOUNCE_MS = 180;
const RESULT_LIMIT = 8;
const EASE = [0.22, 1, 0.36, 1] as const;

function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((v) => typeof v === "string").slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {}
}

/**
 * Search for phones and tablets: a button that opens an in-place search sheet
 * (full-screen on phones, a floating panel on tablets) with recent searches,
 * topics, trending stories and live results. Desktop keeps the /search page.
 */
export function SearchSheet({
  nav,
  tone = "light",
  className,
}: {
  nav: NavData;
  tone?: "light" | "dark";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  const openSheet = () => {
    // iOS only shows the keyboard if an input is focused inside the tap handler itself.
    // Focus a throwaway input now; the sheet's real input takes over focus once mounted.
    const proxy = document.createElement("input");
    proxy.setAttribute("aria-hidden", "true");
    proxy.style.cssText = "position:fixed;top:0;left:0;opacity:0;height:0;font-size:16px;";
    document.body.appendChild(proxy);
    proxy.focus();
    window.setTimeout(() => proxy.remove(), 1000);
    setOpen(true);
  };

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }, []);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          openSheet();
        }}
        aria-label="Search stories"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "flex size-11 items-center justify-center rounded-full transition active:scale-95",
          tone === "dark" ? "text-white hover:bg-white/10" : "text-ink hover:bg-ink/5",
          className,
        )}
      >
        <Search className="size-[21px]" strokeWidth={1.7} aria-hidden />
      </button>
      <Sheet open={open} onClose={close} nav={nav} />
    </>
  );
}

function Sheet({ open, onClose, nav }: { open: boolean; onClose: () => void; nav: NavData }) {
  const router = useRouter();
  const isTablet = useMediaQuery("(min-width: 768px)");
  const dragControls = useDragControls();
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StorySummary[]>([]);
  const [settled, setSettled] = useState("");
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => setMounted(true), []);

  // Open/close side effects: focus, scroll lock, pause the reel, Escape + focus trap.
  useEffect(() => {
    if (!open) return;
    setRecent(readRecent());
    setOverlayOpen(true);
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => input.current?.focus({ preventScroll: true }), 10);

    const onKey = (e: KeyboardEvent) => {
      // Keep page shortcuts (e.g. reel navigation) from firing behind the sheet.
      e.stopPropagation();
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const items = panel.current.querySelectorAll<HTMLElement>("a[href], button, input");
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.clearTimeout(focusTimer);
      root.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey, true);
      setOverlayOpen(false);
    };
  }, [open, onClose]);

  // Reset when closed so the next open starts fresh.
  useEffect(() => {
    if (open) return;
    const t = window.setTimeout(() => {
      setQuery("");
      setResults([]);
      setSettled("");
      setFailed(false);
    }, 300);
    return () => window.clearTimeout(t);
  }, [open]);

  // Live results.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSettled("");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=${RESULT_LIMIT}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const data: { results: StorySummary[] } = await res.json();
        setResults(data.results);
        setSettled(q);
        setFailed(false);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const remember = (q: string) => {
    const value = q.trim();
    if (!value) return;
    const next = [value, ...readRecent().filter((r) => r.toLowerCase() !== value.toLowerCase())];
    writeRecent(next);
    setRecent(next.slice(0, MAX_RECENT));
  };

  const forget = (q: string) => {
    const next = readRecent().filter((r) => r !== q);
    writeRecent(next);
    setRecent(next);
  };

  const submit = (q = query) => {
    const value = q.trim();
    if (!value) return;
    remember(value);
    onClose();
    router.push(`/search?q=${encodeURIComponent(value)}`);
  };

  /**
   * Phones & tablets: stories open as a reel, not an article. If a reel feed on this
   * page already holds the story, it jumps there in place; otherwise go to /watch.
   */
  const openInReel = (slug: string, rememberQuery?: string) => (e: React.MouseEvent) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // allow open-in-new-tab
    e.preventDefault();
    if (rememberQuery) remember(rememberQuery);
    onClose();
    if (!requestOpenStory(slug)) router.push(`${watchPath(slug)}&play=1`);
  };
  const topicHref = (slug: string) => watchPath(undefined, slug);

  const trimmed = query.trim();
  const matchingTopics = trimmed
    ? nav.categories.filter((c) => c.name.toLowerCase().includes(trimmed.toLowerCase()))
    : [];
  const showResults = trimmed.length > 0;

  if (!mounted) return null;

  return createPortal(
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[70]" onClick={(e) => e.stopPropagation()}>
            <m.div
              aria-hidden
              className="absolute inset-0 bg-black/55"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={onClose}
            />
            <m.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-label="Search stories"
              className={cn(
                "absolute flex flex-col overflow-hidden bg-paper text-ink shadow-[0_-10px_40px_rgb(0_0_0/0.25)]",
                // Phones: full-height sheet from the bottom. Tablets: floating panel near the top.
                "inset-x-0 bottom-0 top-[max(env(safe-area-inset-top),12px)] rounded-t-[24px]",
                "md:inset-x-auto md:left-1/2 md:top-[10vh] md:bottom-auto md:max-h-[76vh] md:w-[min(640px,calc(100vw-64px))] md:-translate-x-1/2 md:rounded-[24px]",
              )}
              initial={isTablet ? { opacity: 0, y: -12, scale: 0.98 } : { y: "100%" }}
              animate={isTablet ? { opacity: 1, y: 0, scale: 1 } : { y: 0 }}
              exit={isTablet ? { opacity: 0, y: -8, scale: 0.98 } : { y: "100%" }}
              transition={{ type: "tween", ease: EASE, duration: isTablet ? 0.25 : 0.42 }}
              drag={isTablet ? false : "y"}
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 110 || info.velocity.y > 600) onClose();
              }}
            >
              {/* Grab handle — drag down to dismiss (phones). */}
              <div
                className="flex shrink-0 cursor-grab touch-none justify-center pb-1 pt-2.5 md:hidden"
                onPointerDown={(e) => dragControls.start(e)}
                aria-hidden
              >
                <span className="h-1 w-10 rounded-full bg-ink/15" />
              </div>

              <form
                role="search"
                action="/search"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
                className="flex shrink-0 items-center gap-3 border-b border-line px-4 pb-3 pt-2 md:px-5 md:pt-5"
              >
                <div className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-paper-2 px-4 ring-1 ring-transparent focus-within:bg-surface focus-within:ring-ink/20">
                  <Search className="size-[18px] shrink-0 text-ink/45" strokeWidth={1.8} aria-hidden />
                  <label htmlFor="sheet-search" className="sr-only">
                    Search stories
                  </label>
                  <input
                    ref={input}
                    id="sheet-search"
                    name="q"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search stories, topics, places"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="search"
                    aria-controls={listId}
                    className="h-full min-w-0 flex-1 bg-transparent text-[16px] placeholder:text-ink/40 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => {
                        setQuery("");
                        input.current?.focus();
                      }}
                      aria-label="Clear search"
                      className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-full text-ink/55 hover:bg-ink/5"
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-11 shrink-0 px-1 text-[15px] font-medium text-ink/75 hover:text-ink"
                >
                  Cancel
                </button>
              </form>

              <div id={listId} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+24px)] md:px-5">
                <div aria-live="polite" className="sr-only">
                  {showResults && !loading && settled
                    ? `${results.length} ${results.length === 1 ? "result" : "results"}`
                    : ""}
                </div>

                {!showResults && (
                  <div className="animate-fade-in">
                    {recent.length > 0 && (
                      <section aria-labelledby="recent-heading" className="pt-5">
                        <div className="flex items-center justify-between">
                          <h2 id="recent-heading" className="kicker text-ink/50">
                            Recent
                          </h2>
                          <button
                            type="button"
                            onClick={() => {
                              writeRecent([]);
                              setRecent([]);
                            }}
                            className="min-h-9 px-1 text-[13px] text-ink/55 hover:text-ink"
                          >
                            Clear
                          </button>
                        </div>
                        <ul className="mt-1">
                          {recent.map((r) => (
                            <li key={r} className="flex items-center">
                              <button
                                type="button"
                                onClick={() => setQuery(r)}
                                className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left text-[16px]"
                              >
                                <Clock className="size-4 shrink-0 text-ink/35" aria-hidden />
                                <span className="truncate">{r}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => forget(r)}
                                aria-label={`Remove “${r}” from recent searches`}
                                className="flex size-10 items-center justify-center rounded-full text-ink/35 hover:bg-ink/5 hover:text-ink"
                              >
                                <X className="size-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}

                    <section aria-labelledby="topics-heading" className="pt-6">
                      <h2 id="topics-heading" className="kicker text-ink/50">
                        Browse topics
                      </h2>
                      <ul className="mt-3 flex flex-wrap gap-2">
                        {nav.categories.map((c) => (
                          <li key={c.slug}>
                            <Link
                              href={topicHref(c.slug)}
                              onClick={onClose}
                              className="inline-flex min-h-10 items-center rounded-full bg-paper-2 px-4 text-[14px] text-ink transition-colors hover:bg-ink hover:text-white"
                            >
                              {c.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </section>

                    {nav.trending.length > 0 && (
                      <section aria-labelledby="trending-heading" className="pt-7">
                        <h2 id="trending-heading" className="kicker flex items-center gap-2 text-ink/50">
                          <TrendingUp className="size-3.5" aria-hidden />
                          Trending now
                        </h2>
                        <ol className="mt-2">
                          {nav.trending.map((t, i) => (
                            <li key={t.slug}>
                              <Link
                                href={watchPath(t.slug)}
                                onClick={openInReel(t.slug)}
                                className="flex items-center gap-3.5 rounded-xl py-2.5 transition-colors hover:bg-paper-2"
                              >
                                <span aria-hidden className="w-4 shrink-0 text-center font-serif text-[18px] italic text-accent">
                                  {i + 1}
                                </span>
                                <span className="relative aspect-[9/16] w-10 shrink-0 overflow-hidden rounded-md bg-ink">
                                  <Image src={t.poster} alt="" fill sizes="40px" className="object-cover" />
                                  <span className="absolute inset-0 flex items-center justify-center bg-black/15">
                                    <Play className="size-3 fill-white text-white" aria-hidden />
                                  </span>
                                </span>
                                <span className="min-w-0">
                                  <span className="kicker block text-[10px] text-ink/45">{t.category}</span>
                                  <span className="mt-0.5 line-clamp-2 block font-serif text-[16px] leading-snug">
                                    {t.title}
                                  </span>
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ol>
                      </section>
                    )}
                  </div>
                )}

                {showResults && (
                  <div className="pt-3">
                    {matchingTopics.length > 0 && (
                      <ul aria-label="Matching topics" className="flex flex-wrap gap-2 pb-2 pt-1">
                        {matchingTopics.map((c) => (
                          <li key={c.slug}>
                            <Link
                              href={topicHref(c.slug)}
                              onClick={onClose}
                              className="inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] ring-1 ring-ink/15 hover:bg-ink hover:text-white"
                            >
                              Topic: {c.name}
                              <ArrowUpRight className="size-3.5" aria-hidden />
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}

                    {failed && (
                      <p role="alert" className="mt-3 rounded-xl bg-paper-2 px-4 py-3 text-[14px]">
                        Search is unavailable right now. Please try again.
                      </p>
                    )}

                    {loading && results.length === 0 && !failed && <ResultSkeleton />}

                    {!loading && settled && results.length === 0 && !failed && (
                      <div className="px-2 py-12 text-center">
                        <p className="font-serif text-[24px] leading-tight">No stories match “{settled}”.</p>
                        <p className="mt-2 text-[14px] text-muted">Try a broader word, a place, or one of the topics below.</p>
                        <ul className="mt-5 flex flex-wrap justify-center gap-2">
                          {nav.categories.slice(0, 4).map((c) => (
                            <li key={c.slug}>
                              <Link
                                href={topicHref(c.slug)}
                                onClick={onClose}
                                className="inline-flex min-h-10 items-center rounded-full bg-paper-2 px-4 text-[14px]"
                              >
                                {c.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {results.length > 0 && (
                      <>
                        <ul className={cn("transition-opacity", loading && "opacity-60")}>
                          {results.map((s) => (
                            <li key={s.id}>
                              <Link
                                href={watchPath(s.slug)}
                                onClick={openInReel(s.slug, settled)}
                                className="flex items-center gap-3.5 rounded-xl py-2.5 transition-colors hover:bg-paper-2"
                              >
                                <span className="relative aspect-[9/16] w-12 shrink-0 overflow-hidden rounded-lg bg-ink">
                                  <Image src={s.video.poster} alt="" fill sizes="48px" className="object-cover" />
                                  <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-0.5 bg-black/50 py-0.5 text-[9px] font-medium tabular-nums text-white">
                                    <Play className="size-2 fill-current" aria-hidden />
                                    {formatDuration(s.video.duration)}
                                  </span>
                                </span>
                                <span className="min-w-0">
                                  <span className="kicker block text-[10px] text-ink/45">{s.category.name}</span>
                                  <span className="mt-0.5 line-clamp-2 block font-serif text-[16.5px] leading-snug">
                                    <Highlight text={s.title} query={settled} />
                                  </span>
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          onClick={() => submit(settled)}
                          className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-medium text-white"
                        >
                          See all results for “{settled}”
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>,
    document.body,
  );
}

function ResultSkeleton() {
  return (
    <ul role="status" aria-label="Searching">
      {Array.from({ length: 4 }, (_, i) => (
        <li key={i} className="flex items-center gap-3.5 py-2.5">
          <span className="skeleton aspect-[9/16] w-12 rounded-lg" />
          <span className="flex-1 space-y-2">
            <span className="skeleton block h-2.5 w-20 rounded" />
            <span className="skeleton block h-4 w-11/12 rounded" />
          </span>
        </li>
      ))}
    </ul>
  );
}
