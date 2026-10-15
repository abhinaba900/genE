"use client";

import Lenis from "lenis";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAnyOverlayOpen } from "@/lib/overlay";

/**
 * Smooth, eased page scrolling for mouse wheels and trackpads (Lenis).
 *
 * - Off for reduced motion and touch-first devices, where native scrolling is better.
 *   It reacts live if either setting changes.
 * - It still drives the real window scroll, so sticky headers, IntersectionObserver
 *   reveals, the reading-progress bar and browser back/forward behave as before.
 * - Nested scrollers (reel feed, menu drawer, search sheet, category strip) keep native
 *   scrolling: `allowNestedScroll`, plus `data-lenis-prevent` on those roots.
 * - It pauses while an overlay is open, and settles instantly on client-side navigation,
 *   so Next's scroll restoration is never overridden by a glide in progress.
 * - In-page anchors (e.g. the skip link) stay native, so focus still moves.
 */
export function SmoothScroll() {
  const lenis = useRef<Lenis | null>(null);
  const pathname = usePathname();
  const overlayOpen = useAnyOverlayOpen();

  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");

    const sync = () => {
      const want = !calm.matches && fine.matches;
      if (want && !lenis.current) {
        lenis.current = new Lenis({
          autoRaf: true,
          lerp: 0.1,
          wheelMultiplier: 1,
          allowNestedScroll: true,
          prevent: (node) => node.hasAttribute("data-lenis-prevent"),
        });
      } else if (!want && lenis.current) {
        lenis.current.destroy();
        lenis.current = null;
      }
    };

    sync();
    calm.addEventListener("change", sync);
    fine.addEventListener("change", sync);
    return () => {
      calm.removeEventListener("change", sync);
      fine.removeEventListener("change", sync);
      lenis.current?.destroy();
      lenis.current = null;
    };
  }, []);

  // New page: drop any glide in progress and take the position Next.js chose.
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      lenis.current?.scrollTo(window.scrollY, { immediate: true, force: true });
      lenis.current?.resize();
    });
    return () => cancelAnimationFrame(raf);
  }, [pathname]);

  useEffect(() => {
    if (overlayOpen) lenis.current?.stop();
    else lenis.current?.start();
  }, [overlayOpen]);

  return null;
}
