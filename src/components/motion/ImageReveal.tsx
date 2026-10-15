"use client";

import { m, useReducedMotion, type Variants } from "motion/react";
import { useRef, type ReactNode } from "react";
import { DURATION, EASE } from "./tokens";
import { useReveal } from "./useReveal";

const wipe: Variants = {
  hidden: { clipPath: "inset(100% 0% 0% 0%)" },
  visible: (calm: boolean) => ({
    clipPath: "inset(0% 0% 0% 0%)",
    transition: calm ? { duration: 0 } : { duration: DURATION.media, ease: EASE },
  }),
};

const settle: Variants = {
  hidden: { scale: 1.06 },
  visible: (calm: boolean) => ({
    scale: 1,
    transition: calm ? { duration: 0 } : { duration: DURATION.media + 0.35, ease: EASE },
  }),
};

/**
 * Bottom-up image wipe with a gentle 1.06 → 1 settle, played once on scroll-in.
 * Renders the media container itself: pass the container's classes as `className`
 * (it must be `relative`) and the image as children. Reduced motion shows the image immediately.
 *
 * The container is what's observed and the clip sits on an inner layer: IntersectionObserver
 * honours a target's own clip-path, so a fully clipped element would never count as in view.
 */
export function ImageReveal({ className, children }: { className?: string; children: ReactNode }) {
  const calm = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useReveal(ref);
  return (
    <div ref={ref} className={className}>
      <m.div
        data-reveal
        className="absolute inset-0 overflow-hidden"
        variants={wipe}
        custom={calm}
        initial="hidden"
        // Own in-view state (not `whileInView`), so it still plays when nested in a Reveal.
        animate={inView ? "visible" : "hidden"}
      >
        <m.div data-reveal className="absolute inset-0" variants={settle} custom={calm}>
          {children}
        </m.div>
      </m.div>
    </div>
  );
}
