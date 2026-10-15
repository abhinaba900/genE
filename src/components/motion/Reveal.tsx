"use client";

import { m, useReducedMotion, type Variants } from "motion/react";
import { useRef, type CSSProperties, type ReactNode } from "react";
import { DURATION, EASE, RISE, staggerDelay } from "./tokens";
import { useReveal } from "./useReveal";

const tags = { div: m.div, li: m.li, section: m.section, figure: m.figure, aside: m.aside } as const;

const variants: Variants = {
  hidden: { opacity: 0, y: RISE },
  visible: ({ delay, calm }: { delay: number; calm: boolean }) => ({
    opacity: 1,
    y: 0,
    transition: { duration: calm ? DURATION.calm : DURATION.text, ease: EASE, delay: calm ? 0 : delay },
  }),
};

/**
 * Fades and lifts its content in the first time it scrolls into view.
 * Use it for below-the-fold blocks; page openers use the CSS `.enter` classes instead,
 * so first-paint content never waits for hydration.
 *
 * `index` staggers siblings: pass the item's column (e.g. `i % 3`) for row-by-row grids,
 * or omit it for long lists so every row enters on its own without queuing.
 */
export function Reveal({
  as = "div",
  index,
  className,
  style,
  children,
}: {
  as?: keyof typeof tags;
  index?: number;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const calm = useReducedMotion() ?? false;
  // All tags share HTMLElement props; type them as one so the ref and props line up.
  const Tag = tags[as] as typeof m.div;
  const ref = useRef<HTMLDivElement>(null);
  const inView = useReveal(ref);
  return (
    <Tag
      data-reveal
      className={className}
      style={style}
      variants={variants}
      custom={{ delay: staggerDelay(index), calm }}
      ref={ref}
      initial="hidden"
      // Own in-view state (not `whileInView`), so a reveal nested in another reveal still plays.
      animate={inView ? "visible" : "hidden"}
    >
      {children}
    </Tag>
  );
}
