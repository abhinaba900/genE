"use client";

import Image from "next/image";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { CenterIndicator, ErrorState, LoadingIndicator, ProgressLine } from "./VideoControls";
import { VideoOverlay } from "./VideoOverlay";
import { type PlayerStatus, VideoPlayer } from "./VideoPlayer";
import type { FeedStory } from "./types";
import { track } from "@/lib/analytics";

interface VideoFeedItemProps {
  story: FeedStory;
  index: number;
  total: number;
  /** Signed offset from the active story (next = 1, previous = -1); drives what gets loaded. */
  offset: number;
  isActive: boolean;
  /** Pause requested by the feed (user tap, hidden tab). */
  paused: boolean;
  muted: boolean;
  volume: number;
  saveData: boolean;
  onTogglePlay: () => void;
  onRequestPlay: () => void;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  onUnmuteRejected: () => void;
}

/** One full-viewport story in the reel feed. */
export const VideoFeedItem = memo(function VideoFeedItem({
  story,
  index,
  total,
  offset,
  isActive,
  paused,
  muted,
  volume,
  saveData,
  onTogglePlay,
  onRequestPlay,
  onToggleMute,
  onVolumeChange,
  onUnmuteRejected,
}: VideoFeedItemProps) {
  const progressRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [attempt, setAttempt] = useState(0);
  const [flashKey, setFlashKey] = useState(0);

  // Only the active story and its immediate neighbours hold a <video>.
  // Everything else is a lightweight poster image.
  // The next story is buffered ahead; the previous one keeps only metadata.
  const distance = Math.abs(offset);
  const mountVideo = distance <= 1;
  const preload = isActive ? "auto" : offset === 1 ? (saveData ? "none" : "auto") : "metadata";

  useEffect(() => {
    if (!isActive) setStatus("idle");
    else track("video_impression", story.id, "feed");
  }, [isActive, story.id]);

  useEffect(() => {
    if (isActive && status === "playing") track("video_start", story.id, "feed");
  }, [isActive, status, story.id]);

  const handleTap = useCallback(() => {
    if (!isActive) return;
    if (status === "blocked" || status === "error") {
      setStatus("idle");
      onRequestPlay();
      setAttempt((n) => n + 1);
      return;
    }
    if (!paused) setFlashKey((k) => k + 1);
    onTogglePlay();
  }, [isActive, status, paused, onTogglePlay, onRequestPlay]);

  const indicator = isActive && (status === "blocked" ? "needs-play" : paused ? "paused" : null);
  const headingId = `feed-story-${story.id}`;

  return (
    <article
      // `content-visibility: auto`: off-screen stories skip layout and paint (19 full-screen
      // items made the first layout a long task). Height is explicit, so snap points don't move.
      className="relative h-full w-full snap-start snap-always overflow-hidden bg-night [content-visibility:auto] [contain-intrinsic-height:auto_100dvh] [contain-intrinsic-width:auto_1px]"
      aria-roledescription="story"
      aria-labelledby={headingId}
      aria-setsize={total}
      aria-posinset={index + 1}
      data-index={index}
    >
      {/* Media layer — tapping toggles playback. */}
      <div className="absolute inset-0" onClick={handleTap}>
        <Image
          src={story.video.poster}
          alt=""
          fill
          sizes="(max-width: 767px) 100vw, 56vh"
          priority={index === 0}
          loading={index === 0 ? undefined : distance <= 2 ? "eager" : "lazy"}
          className="object-cover"
        />
        {mountVideo && status !== "error" && (
          <VideoPlayer
            key={attempt}
            src={story.video.src}
            mimeType={story.video.mimeType}
            captions={story.video.captions}
            active={isActive}
            paused={paused}
            muted={muted}
            volume={volume}
            preload={preload}
            progressRef={progressRef}
            onStatusChange={setStatus}
            onUnmuteRejected={onUnmuteRejected}
            onComplete={() => track("video_complete", story.id, "feed")}
            fit={story.video.width >= story.video.height * 0.75 ? "contain" : "cover"}
            label={`Video: ${story.title}`}
          />
        )}
        {isActive && status === "loading" && !paused && <LoadingIndicator />}
        <CenterIndicator state={indicator || null} flashKey={isActive ? flashKey : 0} />
        {/* Screen-reader / keyboard accessible play toggle. */}
        {isActive && (
          <button type="button" onClick={handleTap} className="sr-only focus:not-sr-only focus:absolute focus:left-1/2 focus:top-1/2 focus:-translate-x-1/2 focus:rounded-full focus:bg-black/60 focus:px-4 focus:py-2 focus:text-sm focus:text-white">
            {paused || status === "blocked" ? "Play video" : "Pause video"}
          </button>
        )}
      </div>

      {isActive && status === "error" && <ErrorState onRetry={() => { setStatus("idle"); setAttempt((n) => n + 1); }} />}

      <VideoOverlay
        story={story}
        index={index}
        total={total}
        muted={muted}
        volume={volume}
        onToggleMute={onToggleMute}
        onVolumeChange={onVolumeChange}
        headingId={headingId}
        compact={isActive && status === "playing" && !paused}
      />

      <ProgressLine barRef={progressRef} className="absolute inset-x-0 bottom-[env(safe-area-inset-bottom)]" />
    </article>
  );
});
