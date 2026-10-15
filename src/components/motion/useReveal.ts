"use client";

import { useInView } from "motion/react";
import { useSyncExternalStore, type RefObject } from "react";
import { VIEWPORT } from "./tokens";

/** True once the page is scrolled to (within a few px of) the very bottom. */
function subscribe(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true });
  window.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("scroll", onChange);
    window.removeEventListener("resize", onChange);
  };
}
const atPageEnd = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;

/**
 * When a reveal should play: once the element's top has climbed past the reveal line
 * (`VIEWPORT.margin`, ~78% down the screen), so it animates while the reader is looking at it.
 *
 * Fallback: an item that can never climb that far (it sits in the last stretch of a short page)
 * plays when the reader reaches the end of the page, provided it's on screen at all.
 */
export function useReveal(ref: RefObject<Element | null>) {
  const pastLine = useInView(ref, VIEWPORT);
  const onScreen = useInView(ref, { once: true, amount: "some" });
  const end = useSyncExternalStore(subscribe, atPageEnd, () => false);
  return pastLine || (onScreen && end);
}
