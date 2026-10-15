"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { MobileNavigation } from "@/components/layout/MobileNavigation";
import type { NavData } from "@/components/layout/nav";
import { SearchSheet } from "@/components/search/SearchSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";
import { useMediaQuery, usePrefersReducedMotion, useSaveData } from "@/lib/hooks/useMediaQuery";
import { useAnyOverlayOpen, useOpenStoryListener } from "@/lib/overlay";
import { DEFAULT_VOLUME, readStoredVolume, storeVolume } from "@/lib/volume";
import { CategorySelector, categoryHref } from "./CategorySelector";
import { useCategorySwipe } from "./useCategorySwipe";
import { VideoFeedItem } from "./VideoFeedItem";
import type { FeedStory } from "./types";

interface VideoFeedProps {
  stories: FeedStory[];
  nav: NavData;
  activeCategory?: string;
  /**
   * "mobile": rendered inside a `md:hidden` wrapper next to the desktop page;
   *           stays dormant (no video, no listeners) unless the viewport is mobile-sized.
   * "standalone": the dedicated /watch experience at any size, framed as a 9:16 column on desktop.
   */
  variant?: "mobile" | "standalone";
}

const WHEEL_THRESHOLD = 24;
const WHEEL_MIN_LOCK_MS = 480;
const WHEEL_QUIET_MS = 160;

/** Immersive, vertically-snapping reel of story videos. */
export function VideoFeed({ stories, nav, activeCategory, variant = "mobile" }: VideoFeedProps) {
  const isMobileViewport = useMediaQuery("(max-width: 767px)");
  const enabled = variant === "standalone" || isMobileViewport;
  const reducedMotion = usePrefersReducedMotion();
  const saveData = useSaveData();
  // Reduced motion / data → no autoplay until the visitor presses play once; then the feed continues on its own.
  const [optedIn, setOptedIn] = useState(false);
  const autoplay = optedIn || (!reducedMotion && !saveData);

  const scroller = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [userPaused, setUserPaused] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const restored = useRef(false);
  const total = stories.length;

  // ── Restore position from ?story=slug (e.g. returning from an article) ──
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || restored.current) return;
    restored.current = true;
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("story");
    if (params.has("play")) {
      setOptedIn(true);
      params.delete("play");
      const qs = params.toString();
      window.history.replaceState(window.history.state, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
    const index = slug ? stories.findIndex((s) => s.slug === slug) : -1;
    if (index > 0) {
      el.scrollTop = index * el.clientHeight;
      setActive(index);
      setHasMoved(true);
    }
  }, [stories]);

  // ── Track the active story from scroll position ──
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = el.clientHeight || 1;
        // Index `total` is the end card.
        const index = Math.min(total, Math.max(0, Math.round(el.scrollTop / h)));
        setActive(index);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("scroll", onScroll);
    };
  }, [total]);

  // ── When the story changes: reset pause, remember position in the URL ──
  useEffect(() => {
    setUserPaused(!autoplay);
  }, [active, autoplay]);

  const lastActive = useRef(active);
  useEffect(() => {
    if (lastActive.current === active) return;
    lastActive.current = active;
    setHasMoved(true);
    const story = stories[active];
    if (!story || !enabled) return;
    const url = new URL(window.location.href);
    url.searchParams.set("story", story.slug);
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }, [active, enabled, stories]);

  // ── Pause when the tab is hidden ──
  useEffect(() => {
    const onVisibility = () => setPageHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const goTo = useCallback(
    (index: number) => {
      const el = scroller.current;
      if (!el) return;
      const target = Math.min(total, Math.max(0, index)); // `total` = end card
      el.scrollTo({ top: target * el.clientHeight, behavior: reducedMotion ? "auto" : "smooth" });
    },
    [total, reducedMotion],
  );

  // ── Wheel / trackpad: one story per gesture ──
  useEffect(() => {
    const el = scroller.current;
    if (!el || !enabled) return;
    let accumulated = 0;
    let lockedUntil = 0;
    let lastEvent = 0;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      e.preventDefault();
      const now = performance.now();
      const quiet = now - lastEvent > WHEEL_QUIET_MS;
      lastEvent = now;
      // Ignore trailing inertia until the gesture has gone quiet.
      if (now < lockedUntil || (!quiet && accumulated === Infinity)) return;
      if (quiet) accumulated = 0;
      accumulated += e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      if (Math.abs(accumulated) >= WHEEL_THRESHOLD) {
        const h = el.clientHeight || 1;
        const current = Math.round(el.scrollTop / h);
        goTo(current + (accumulated > 0 ? 1 : -1));
        accumulated = Infinity; // locked for the remainder of this gesture
        lockedUntil = now + WHEEL_MIN_LOCK_MS;
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [enabled, goTo]);

  // ── Horizontal swipe / drag: neighbouring category ──
  const router = useRouter();
  const frame = useRef<HTMLDivElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const reel = useRef<HTMLDivElement>(null);
  const basePath = variant === "standalone" ? "/watch" : "";
  const categories = nav.categories;
  const categoryIndex = activeCategory ? categories.findIndex((c) => c.slug === activeCategory) + 1 : 0;
  // Index 0 is "For you"; category i lives at categories[i - 1].
  const tabAt = (i: number) =>
    i === 0 ? { slug: undefined, name: "For you" } : categories[i - 1] ? categories[i - 1] : null;
  const prevCategory = categoryIndex > 0 ? tabAt(categoryIndex - 1) : null;
  const nextCategory = tabAt(categoryIndex + 1);
  const prevHref = prevCategory ? categoryHref(prevCategory.slug, basePath) : null;
  const nextHref = nextCategory ? categoryHref(nextCategory.slug, basePath) : null;
  const switchCategory = useCallback(
    (dir: -1 | 1) => {
      const href = dir === 1 ? nextHref : prevHref;
      if (href) router.replace(href, { scroll: false });
    },
    [router, prevHref, nextHref],
  );
  useEffect(() => {
    if (!enabled) return;
    if (prevHref) router.prefetch(prevHref);
    if (nextHref) router.prefetch(nextHref);
  }, [enabled, router, prevHref, nextHref]);
  const swipeProgress = useCategorySwipe({
    frameRef: frame,
    surfaceRef: surface,
    contentRef: reel,
    enabled,
    hasPrev: !!prevCategory,
    hasNext: !!nextCategory,
    reducedMotion,
    onCommit: switchCategory,
  });

  const togglePlay = useCallback(() => {
    setUserPaused((p) => {
      if (p) setOptedIn(true);
      return !p;
    });
  }, []);
  const requestPlay = useCallback(() => {
    setOptedIn(true);
    setUserPaused(false);
  }, []);

  // ── Search (or anything else) can ask this feed to jump straight to a story ──
  const openStory = useCallback(
    (slug: string) => {
      const el = scroller.current;
      const index = stories.findIndex((s) => s.slug === slug);
      if (!enabled || !el || index < 0) return false;
      // Jump instantly — scrolling past many reels would load each of them.
      el.scrollTo({ top: index * el.clientHeight, behavior: "auto" });
      setActive(index);
      requestPlay(); // tapping a result is a clear intent to watch
      return true;
    },
    [enabled, stories, requestPlay],
  );
  useOpenStoryListener(openStory);
  // Remember the visitor's volume between visits (per-browser convenience only).
  useEffect(() => {
    const saved = readStoredVolume();
    if (saved) setVolume(saved);
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      // Unmuting at zero volume would be silent — restore a sensible level.
      if (m) setVolume((v) => (v === 0 ? 0.6 : v));
      return !m;
    });
  }, []);
  const changeVolume = useCallback((v: number) => {
    setVolume(v);
    setMuted(v === 0);
    storeVolume(v);
  }, []);
  const onUnmuteRejected = useCallback(() => setMuted(true), []);

  // ── Keyboard ──
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target instanceof Element ? e.target : null;
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if (target?.closest("input, textarea, select, [role='slider'], [contenteditable='true']")) return;
      const h = scroller.current?.clientHeight || 1;
      const current = Math.round((scroller.current?.scrollTop ?? 0) / h);
      switch (e.key) {
        case "ArrowDown":
        case "PageDown":
        case "j":
          e.preventDefault();
          goTo(current + 1);
          break;
        case "ArrowUp":
        case "PageUp":
        case "k":
          e.preventDefault();
          goTo(current - 1);
          break;
        case "Home":
          e.preventDefault();
          goTo(0);
          break;
        case "End":
          e.preventDefault();
          goTo(total - 1);
          break;
        case " ":
          if (target?.closest("button, a")) return;
          e.preventDefault();
          togglePlay();
          break;
        case "m":
          toggleMute();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, goTo, total, togglePlay, toggleMute]);

  const standalone = variant === "standalone";
  // Pause behind the menu drawer / search sheet.
  const overlayOpen = useAnyOverlayOpen();
  const paused = userPaused || pageHidden || overlayOpen;
  const onEndCard = active >= total;

  return (
    <div
      // The reel has its own snap/wheel handling; keep page smooth-scrolling out of it.
      data-lenis-prevent
      ref={surface}
      className={cn(
        // pan-y everywhere (incl. the top bar and the area beside the /watch frame): the browser
        // only ever scrolls vertically, so horizontal swipes always reach the category gesture.
        // The tab strip is its own horizontal scroller, so it keeps sideways scrolling.
        "fixed inset-0 z-30 touch-pan-y overflow-hidden bg-night text-white",
        standalone && "md:flex md:items-stretch md:justify-center",
      )}
    >
      {/* Desktop backdrop for the framed /watch column. */}
      {standalone && stories[active] && (
        <div aria-hidden className="absolute inset-0 hidden md:block">
          <Image
            key={stories[active].slug}
            src={stories[active].video.poster}
            alt=""
            fill
            sizes="10vw"
            className="animate-fade-in scale-110 object-cover opacity-40 blur-3xl"
          />
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}

      <div
        ref={frame}
        className={cn(
          "relative h-full w-full",
          standalone && "md:aspect-[9/16] md:h-full md:w-auto md:max-w-full md:shadow-[0_0_80px_rgb(0_0_0/0.5)] md:animate-[player-in_0.5s_var(--ease-out-soft)_both]",
        )}
      >
        {/* Persistent top bar */}
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20">
          <div aria-hidden className="absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/60 via-black/25 to-transparent" />
          <div className="pointer-events-auto relative pt-safe">
            <div className="flex items-center justify-between pl-5 pr-2 pt-2">
              <Wordmark className="h-8" onMedia priority />
              <div className="flex items-center">
                <SearchSheet nav={nav} tone="dark" />
                <MobileNavigation nav={nav} tone="dark" />
              </div>
            </div>
            <CategorySelector categories={nav.categories} active={activeCategory} basePath={standalone ? "/watch" : ""} />
          </div>
        </div>

        <p id="feed-instructions" className="sr-only">
          Story feed. Use the up and down arrow keys, or the previous and next buttons, to move between stories. Press
          space to pause, M to toggle sound.
        </p>

        {total === 0 ? (
          <EmptyState
            tone="dark"
            className="h-full"
            title="No stories here yet."
            description="This category doesn’t have any published stories. Check back soon, or explore everything."
            action={{ label: "Watch all stories", href: standalone ? "/watch" : "/" }}
          />
        ) : (
          <div className="h-full overflow-hidden">
          <div ref={reel} className="h-full will-change-transform">
          <div
            ref={scroller}
            role="region"
            aria-roledescription="story feed"
            aria-label="Stories"
            aria-describedby="feed-instructions"
            className="h-full touch-pan-y snap-y snap-mandatory overflow-y-auto overscroll-y-contain scrollbar-none"
          >
            {stories.map((story, i) => (
              <VideoFeedItem
                key={story.id}
                story={story}
                index={i}
                total={total}
                offset={enabled ? Math.max(-3, Math.min(3, i - active)) : 3}
                isActive={enabled && i === active}
                paused={paused}
                muted={muted}
                volume={volume}
                saveData={saveData}
                onTogglePlay={togglePlay}
                onRequestPlay={requestPlay}
                onToggleMute={toggleMute}
                onVolumeChange={changeVolume}
                onUnmuteRejected={onUnmuteRejected}
              />
            ))}
            <EndCard onRestart={() => goTo(0)} activeCategory={activeCategory} />
          </div>
          </div>
          </div>
        )}

        {/* Category swipe hint — the tab you'll land on, revealed as you drag. */}
        {swipeProgress !== 0 && (
          <SwipeHint
            side={swipeProgress < 0 ? "right" : "left"}
            name={(swipeProgress < 0 ? nextCategory : prevCategory)?.name}
            progress={Math.abs(swipeProgress)}
          />
        )}

        {/* Swipe hint — fades away after the first move. */}
        {total > 1 && !hasMoved && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+6px)] z-10 flex justify-center"
          >
            <span className="flex animate-nudge items-center gap-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white">
              <ChevronUp className="size-3.5" strokeWidth={2} />
              {standalone ? "Scroll for next" : "Swipe for next"}
            </span>
          </div>
        )}

        {/* Explicit previous / next controls: visible on desktop, focusable for keyboard & switch users on mobile. */}
        {total > 0 && (
          <div
            className={cn(
              "absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-2",
              standalone ? "md:-right-20" : "",
            )}
          >
            <FeedNavButton label="Previous story" disabled={active === 0} onClick={() => goTo(active - 1)} standalone={standalone}>
              <ChevronUp className="size-5" strokeWidth={1.8} />
            </FeedNavButton>
            <FeedNavButton label="Next story" disabled={onEndCard} onClick={() => goTo(active + 1)} standalone={standalone}>
              <ChevronDown className="size-5" strokeWidth={1.8} />
            </FeedNavButton>
          </div>
        )}
      </div>
    </div>
  );
}

function SwipeHint({ side, name, progress }: { side: "left" | "right"; name?: string; progress: number }) {
  if (!name) return null;
  const ready = progress >= 1;
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute top-1/2 z-20 -translate-y-1/2", side === "right" ? "right-4" : "left-4")}
      style={{ opacity: Math.min(1, progress * 1.4) }}
    >
      <span
        className={cn(
          "flex items-center gap-1 rounded-full px-3.5 py-2 text-[13px] font-semibold backdrop-blur-md transition-colors duration-150",
          ready ? "bg-white text-ink" : "bg-black/45 text-white ring-1 ring-white/20",
        )}
      >
        {side === "left" && <ChevronLeft className="size-4" strokeWidth={2} />}
        {name}
        {side === "right" && <ChevronRight className="size-4" strokeWidth={2} />}
      </span>
    </div>
  );
}

function FeedNavButton({
  label,
  disabled,
  onClick,
  standalone,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  standalone: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex size-11 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition hover:bg-white/20 disabled:opacity-30",
        // Hidden visually on touch layouts unless focused; always shown beside the desktop frame.
        standalone ? "max-md:sr-only max-md:focus:not-sr-only" : "sr-only focus:not-sr-only",
      )}
    >
      {children}
    </button>
  );
}

function EndCard({ onRestart, activeCategory }: { onRestart: () => void; activeCategory?: string }) {
  return (
    <section
      aria-label="End of feed"
      className="relative flex h-full snap-start snap-always flex-col items-center justify-center bg-night px-8 text-center"
    >
      <span aria-hidden className="mb-6 block h-px w-10 bg-white/30" />
      <h2 className="font-serif text-[34px] leading-tight tracking-tight">You’re all caught up.</h2>
      <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-white/60">
        That’s every story{activeCategory ? " in this category" : ""} for now. Keep reading, or start again from the top.
      </p>
      <div className="mt-8 flex flex-col items-center gap-3">
        <Link
          href="/latest"
          className="inline-flex min-h-12 items-center rounded-full bg-white px-6 text-[15px] font-semibold text-ink"
        >
          Browse latest stories
        </Link>
        <button
          type="button"
          onClick={onRestart}
          className="inline-flex min-h-11 items-center px-4 text-[14px] text-white/70 underline-offset-4 hover:text-white hover:underline"
        >
          Back to the first story
        </button>
      </div>
    </section>
  );
}
