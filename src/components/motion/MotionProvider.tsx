"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

/**
 * Site-wide Motion setup: the small `domAnimation` feature bundle (shared with the
 * menu drawer) and `reducedMotion="user"`, which drops transform animations for
 * visitors who ask for less motion while keeping short fades.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
