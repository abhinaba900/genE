"use client";

import { useEffect, useState } from "react";

/**
 * Tiny cross-component signal for full-screen overlays (menu drawer, search sheet).
 * The reel feed listens so it can pause playback while an overlay covers it.
 */
const EVENT = "gen-e:overlay";
let openCount = 0;

export function setOverlayOpen(open: boolean) {
  openCount = Math.max(0, openCount + (open ? 1 : -1));
  window.dispatchEvent(new CustomEvent(EVENT, { detail: openCount > 0 }));
}

export function useAnyOverlayOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onChange = (e: Event) => setOpen((e as CustomEvent<boolean>).detail);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return open;
}

/**
 * Ask a mounted reel feed to jump to a story. Returns true if a feed on the
 * current page handled it; otherwise the caller should navigate to the reel.
 */
const OPEN_STORY_EVENT = "gen-e:open-story";
type OpenStoryDetail = { slug: string; handled: boolean };

export function requestOpenStory(slug: string) {
  const detail: OpenStoryDetail = { slug, handled: false };
  window.dispatchEvent(new CustomEvent(OPEN_STORY_EVENT, { detail }));
  return detail.handled;
}

export function useOpenStoryListener(handler: (slug: string) => boolean) {
  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<OpenStoryDetail>).detail;
      if (!detail.handled && handler(detail.slug)) detail.handled = true;
    };
    window.addEventListener(OPEN_STORY_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_STORY_EVENT, onOpen);
  }, [handler]);
}
