/**
 * Motion tokens for JS-driven animation (search results, reveal stagger).
 * CSS twins live in globals.css (`--motion-*`); keep the two in step.
 */
export const EASE = [0.22, 1, 0.36, 1] as const;

export const DURATION = {
  /** Text and card entrances. */
  text: 0.55,
  /** Image wipes. */
  media: 0.85,
  /** Reduced-motion fallback: a short fade only. */
  calm: 0.2,
} as const;

/** Seconds between items in a row. */
export const STAGGER = 0.07;
/** Longest delay any single item waits, so long lists never queue up. */
export const MAX_STAGGER_STEPS = 4;
/** Entrance offset in px. */
export const RISE = 20;

export const staggerDelay = (index = 0) => Math.min(index, MAX_STAGGER_STEPS) * STAGGER;
