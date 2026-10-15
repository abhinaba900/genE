"use client";

import { useEffect } from "react";
import { type Surface, track } from "@/lib/analytics";

/** Records one article view per story per tab session. Renders nothing. */
export function TrackView({ storyId, surface = "article" }: { storyId?: string; surface?: Surface }) {
  useEffect(() => {
    track("page_view", storyId, surface);
  }, [storyId, surface]);
  return null;
}
