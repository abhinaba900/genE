"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { staggerDelay } from "./tokens";
import { registerReveal } from "./reveal-observer";

type Tag = "div" | "li" | "section" | "figure" | "aside";

/**
 * Fades and lifts its content in when it's genuinely in view (top past ~78% of the screen).
 *
 * Pure CSS + one shared IntersectionObserver (no animation runtime): the server HTML is
 * visible and plays a first-paint entrance; after hydration, items below the fold are
 * hidden and revealed on scroll. See `[data-reveal]` in globals.css.
 *
 * `index` staggers siblings: pass the item's column (e.g. `i % 3`) for row-by-row grids,
 * or omit it for long lists so every row enters on its own without queuing.
 */
export function Reveal({
  as: Tag = "div",
  index,
  className,
  style,
  children,
}: {
  as?: Tag;
  index?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const ref = useRef<HTMLElement | null>(null);
  // Runs before paint, so a below-the-fold item is hidden before it could be seen.
  useLayoutEffect(() => (ref.current ? registerReveal(ref.current) : undefined), []);
  const delay = staggerDelay(index);
  return (
    <Tag
      // Callback ref keeps one ref type across the different tags.
      ref={(el: HTMLElement | null) => {
        ref.current = el;
      }}
      data-reveal=""
      className={className}
      style={delay ? ({ ...style, "--reveal-delay": `${Math.round(delay * 1000)}ms` } as CSSProperties) : style}
    >
      {children}
    </Tag>
  );
}
