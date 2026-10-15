"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { registerReveal } from "./reveal-observer";

/**
 * Bottom-up image wipe with a gentle 1.06 → 1 settle, played when the image is in view.
 * Renders the media container itself: pass the container's classes as `className`
 * (it must be `relative`) and the image as children.
 *
 * Same model as `Reveal`: visible in the server HTML with a first-paint wipe, hidden after
 * hydration only if it's below the fold. The clip sits on an inner layer because
 * IntersectionObserver honours a target's own clip-path. Styles: `[data-wipe]` in globals.css.
 */
export function ImageReveal({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => (ref.current ? registerReveal(ref.current) : undefined), []);
  return (
    <div ref={ref} data-wipe="" className={className}>
      <div data-wipe-clip="" className="absolute inset-0 overflow-hidden">
        <div data-wipe-settle="" className="absolute inset-0">
          {children}
        </div>
      </div>
    </div>
  );
}
