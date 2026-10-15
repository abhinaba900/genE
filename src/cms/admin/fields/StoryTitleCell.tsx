"use client";

/* eslint-disable @next/next/no-img-element -- admin list thumbnails come from object storage, outside next/image. */
import { Film } from "lucide-react";
import Link from "next/link";
import type { DefaultCellComponentProps } from "payload";
import { useEffect, useState } from "react";

type Ref = { id?: number | string; url?: string | null; posterUrl?: string | null; sizes?: { thumbnail?: { url?: string | null } } } | number | string | null | undefined;

/**
 * Payload loads list rows at depth 0, so uploads arrive as bare IDs. Each row asks for its
 * thumbnail; requests made in the same tick are batched into one query per collection.
 */
const cache = new Map<string, Promise<string | null>>();
const queue: Record<"media" | "videos", Map<string, (url: string | null) => void>> = { media: new Map(), videos: new Map() };
let scheduled = false;

function flush() {
  scheduled = false;
  for (const collection of ["media", "videos"] as const) {
    const pending = new Map(queue[collection]);
    queue[collection].clear();
    if (!pending.size) continue;
    const field = collection === "videos" ? "posterUrl" : "url";
    const params = new URLSearchParams({ depth: "0", limit: String(pending.size), [`select[${field}]`]: "true", "where[id][in]": [...pending.keys()].join(",") });
    if (collection === "media") params.set("select[sizes]", "true");
    fetch(`/api/${collection}?${params}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { docs: [] }))
      .then(({ docs }: { docs: Exclude<Ref, number | string | null | undefined>[] }) => {
        const found = new Map(docs.map((d) => [String(d.id), d.posterUrl ?? d.sizes?.thumbnail?.url ?? d.url ?? null]));
        pending.forEach((resolve, id) => resolve(found.get(id) ?? null));
      })
      .catch(() => pending.forEach((resolve) => resolve(null)));
  }
}

function load(collection: "media" | "videos", id: number | string) {
  const key = `${collection}:${id}`;
  if (!cache.has(key)) {
    cache.set(key, new Promise((resolve) => queue[collection].set(String(id), resolve)));
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(flush);
    }
  }
  return cache.get(key)!;
}

/**
 * Video rows carry their own poster URL. Story rows use the featured image if set, otherwise
 * the video's poster — the same fallback the website uses.
 */
function useThumbnail(row: Record<string, unknown>) {
  const image = row.featuredImage as Ref;
  const video = row.video as Ref;
  const inline =
    (typeof row.posterUrl === "string" && row.posterUrl) ||
    (image && typeof image === "object" && (image.sizes?.thumbnail?.url || image.url)) ||
    (!image && video && typeof video === "object" && video.posterUrl) ||
    null;
  const [src, setSrc] = useState<string | null>(inline);

  useEffect(() => {
    if (inline) return;
    let live = true;
    const imageId = image && typeof image !== "object" ? image : undefined;
    const videoId = video && typeof video !== "object" ? video : undefined;
    (async () => {
      const url = (imageId != null ? await load("media", imageId) : null) ?? (videoId != null ? await load("videos", videoId) : null);
      if (live) setSrc(url);
    })();
    return () => {
      live = false;
    };
  }, [inline, image, video]);

  return src;
}

/**
 * Title column for the stories and videos lists: a 9:16 thumbnail beside the title, so editors
 * can recognise an item at a glance. Keeps Payload's behaviour of linking the first column (or
 * selecting the row when the list is opened inside a relationship drawer).
 */
export function StoryTitleCell({ cellData, rowData, collectionSlug, link, linkURL, onClick }: DefaultCellComponentProps) {
  const src = useThumbnail(rowData);
  const title = (typeof cellData === "string" && cellData) || (collectionSlug === "videos" ? "Untitled video" : "Untitled story");
  const body = (
    <>
      {src ? (
        <img src={src} alt="" width={34} height={48} loading="lazy" className="gene-story__thumb" />
      ) : (
        <span className="gene-story__thumb gene-story__thumb--empty">
          <Film size={14} aria-hidden />
        </span>
      )}
      <span className="gene-cell-story__title">{title}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="gene-cell-story" onClick={() => onClick({ cellData, collectionSlug, rowData })}>
        {body}
      </button>
    );
  }
  if (link) {
    return (
      <Link href={linkURL ?? `/admin/collections/${collectionSlug}/${rowData.id}`} className="gene-cell-story" prefetch={false}>
        {body}
      </Link>
    );
  }
  return <span className="gene-cell-story">{body}</span>;
}
