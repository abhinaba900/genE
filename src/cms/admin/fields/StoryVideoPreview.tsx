"use client";

import { useConfig, useFormFields } from "@payloadcms/ui";
import { ArrowRight, Film } from "lucide-react";
import { useEffect, useState } from "react";

type VideoDoc = {
  id: number;
  title: string;
  url?: string;
  playbackUrl?: string | null;
  posterUrl?: string | null;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  status?: string;
};

/**
 * A phone-sized preview of how this story appears in the mobile feed, updating as the
 * editor types. The full-fidelity preview (real site, mobile and desktop) is the
 * Live Preview button at the top of the editor.
 */
export function StoryVideoPreview() {
  const { config } = useConfig();
  const api = `${config.serverURL}${config.routes.api}`;
  const videoValue = useFormFields(([f]) => f.video?.value) as number | { id: number } | null | undefined;
  const title = useFormFields(([f]) => f.title?.value) as string | undefined;
  const shortTitle = useFormFields(([f]) => f.shortTitle?.value) as string | undefined;
  const excerpt = useFormFields(([f]) => f.excerpt?.value) as string | undefined;
  const categoryValue = useFormFields(([f]) => f.category?.value) as number | { id: number } | null | undefined;

  const videoId = typeof videoValue === "object" ? videoValue?.id : videoValue;
  const categoryId = typeof categoryValue === "object" ? categoryValue?.id : categoryValue;
  const [video, setVideo] = useState<VideoDoc | null>(null);
  const [category, setCategory] = useState<{ name: string; tint?: string } | null>(null);

  useEffect(() => {
    if (!videoId) return setVideo(null);
    const ctrl = new AbortController();
    fetch(`${api}/videos/${videoId}?depth=0`, { credentials: "include", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then(setVideo)
      .catch(() => {});
    return () => ctrl.abort();
  }, [api, videoId]);

  useEffect(() => {
    if (!categoryId) return setCategory(null);
    const ctrl = new AbortController();
    fetch(`${api}/categories/${categoryId}?depth=0`, { credentials: "include", signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then(setCategory)
      .catch(() => {});
    return () => ctrl.abort();
  }, [api, categoryId]);

  const src = video?.url;
  return (
    <div className="gene-phone-preview">
      <div className="gene-phone" aria-label="Mobile feed preview">
        {src ? (
          <video key={src} src={src} poster={video?.posterUrl ?? undefined} muted loop playsInline autoPlay className="gene-phone__video" />
        ) : (
          <div className="gene-phone__empty">
            <Film size={28} aria-hidden />
            <span>Add a video to preview the feed</span>
          </div>
        )}
        <div className="gene-phone__overlay">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/gen-e-logo.png" alt="" className="gene-phone__brand" />
          <div>
            <p className="gene-phone__kicker">{category?.name ?? "Category"}</p>
            <p className="gene-phone__title">{shortTitle || title || "Your headline appears here"}</p>
            {excerpt && <p className="gene-phone__excerpt">{excerpt}</p>}
            <span className="gene-phone__cta">
              Read full story <ArrowRight size={13} aria-hidden />
            </span>
          </div>
        </div>
      </div>
      <div className="gene-phone-preview__aside">
        <p className="gene-help">
          This is how the story appears in the mobile feed. Use <strong>Live Preview</strong> at the top to see the real page on mobile and desktop.
        </p>
        {video && (
          <dl className="gene-facts">
            <dt>Video</dt>
            <dd>
              <a href={`/admin/collections/videos/${video.id}`} target="_blank" rel="noopener">
                {video.title}
              </a>
            </dd>
            {video.duration ? (
              <>
                <dt>Length</dt>
                <dd>
                  {Math.floor(video.duration / 60)}:{String(Math.round(video.duration % 60)).padStart(2, "0")}
                </dd>
              </>
            ) : null}
            <dt>Status</dt>
            <dd>{video.status === "ready" ? "Ready" : video.status === "error" ? "Error — open the video to retry" : "Processing — open and save the video"}</dd>
          </dl>
        )}
      </div>
    </div>
  );
}
