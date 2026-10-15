"use client";

import { useField, useFormFields } from "@payloadcms/ui";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Meta = { duration: number; width: number; height: number };

/**
 * Reads duration and dimensions in the browser (from the chosen file, or from the stored
 * URL for existing videos) and fills the read-only metadata fields. No server-side
 * transcoding or probing is needed, so large files are never processed by Next.js.
 */
export function VideoMetadata() {
  const file = useFormFields(([f]) => f.file?.value) as File | undefined;
  const url = useFormFields(([f]) => f.url?.value) as string | undefined;
  const status = useFormFields(([f]) => f.status?.value) as string | undefined;
  const duration = useField<number>({ path: "duration" });
  const width = useField<number>({ path: "width" });
  const height = useField<number>({ path: "height" });

  const [state, setState] = useState<"idle" | "reading" | "ok" | "error">("idle");
  const [source, setSource] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => {
    if (file instanceof File && file.type.startsWith("video/")) {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = URL.createObjectURL(file);
      setSource(objectUrl.current);
      setState("reading");
    } else if (url) {
      setSource(url);
      setState(duration.value && width.value ? "ok" : "reading");
    }
    return () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, url]);

  function onLoaded(e: React.SyntheticEvent<HTMLVideoElement>) {
    const v = e.currentTarget;
    if (!v.videoWidth || !Number.isFinite(v.duration)) {
      setState("error");
      return;
    }
    const next = { duration: Math.round(v.duration * 10) / 10, width: v.videoWidth, height: v.videoHeight };
    setMeta(next);
    if (duration.value !== next.duration) duration.setValue(next.duration);
    if (width.value !== next.width) width.setValue(next.width);
    if (height.value !== next.height) height.setValue(next.height);
    setState("ok");
  }

  if (!source) {
    return (
      <p className="gene-help">
        Choose an MP4 above. The upload goes straight to storage, and duration and size are detected automatically.
      </p>
    );
  }

  const m = meta ?? (duration.value ? { duration: duration.value, width: width.value ?? 0, height: height.value ?? 0 } : null);
  const ratio = m && m.height ? m.width / m.height : null;
  const vertical = ratio !== null && Math.abs(ratio - 9 / 16) < 0.03;

  return (
    <div className="gene-video-meta">
      <video
        key={source}
        src={source}
        preload="metadata"
        muted
        playsInline
        controls
        onLoadedMetadata={onLoaded}
        onError={() => setState("error")}
        className="gene-video-meta__player"
        style={ratio ? { aspectRatio: String(ratio) } : undefined}
      />
      <div className="gene-video-meta__facts">
        {state === "reading" && (
          <p className="gene-help">
            <Loader2 size={14} className="gene-spin" aria-hidden /> Reading video details…
          </p>
        )}
        {state === "error" && (
          <p className="gene-help gene-help--error">
            <AlertTriangle size={14} aria-hidden /> This browser can't read the video. Re-export as MP4 (H.264 + AAC) and try again.
          </p>
        )}
        {m && (
          <dl>
            <dt>Duration</dt>
            <dd>{formatDuration(m.duration)}</dd>
            <dt>Size</dt>
            <dd>
              {m.width}×{m.height}
            </dd>
            <dt>Shape</dt>
            <dd>{vertical ? "Vertical 9:16" : ratio && ratio < 1 ? "Vertical (not 9:16)" : "Horizontal / square"}</dd>
            {status && (
              <>
                <dt>Status</dt>
                <dd>{status === "ready" ? "Ready" : status === "processing" ? "Save to finish" : status}</dd>
              </>
            )}
          </dl>
        )}
        {m && !vertical && (
          <p className="gene-help gene-help--warn">
            <AlertTriangle size={14} aria-hidden /> Not 9:16. It will play letterboxed in the mobile feed.
          </p>
        )}
        {m && vertical && (
          <p className="gene-help gene-help--ok">
            <CheckCircle2 size={14} aria-hidden /> Perfect for the mobile feed.
          </p>
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
