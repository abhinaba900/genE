"use client";

import { RefreshRouteOnSave } from "@payloadcms/live-preview-react";
import { Eye } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Banner shown on every preview page, plus Payload Live Preview wiring: when the
 * editor's draft autosaves, the page re-renders with the new content.
 */
export function PreviewBar({
  label,
  status,
  editHref,
  views,
}: {
  label: string;
  status?: string;
  editHref: string;
  views?: { label: string; href: string; active: boolean }[];
}) {
  const router = useRouter();
  const serverURL = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <>
      <RefreshRouteOnSave refresh={() => router.refresh()} serverURL={serverURL} />
      <div role="status" className="fixed inset-x-0 bottom-0 z-[90] flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-accent px-4 py-2.5 text-[13px] text-white pb-safe">
        <span className="inline-flex items-center gap-2 font-medium">
          <Eye className="size-4" aria-hidden /> Preview — {label}
          {status && <span className="rounded-full bg-white/20 px-2 py-0.5 text-[12px]">{status.replace("_", " ")}</span>}
        </span>
        {views && (
          <span className="inline-flex gap-1 rounded-full bg-white/15 p-0.5">
            {views.map((v) => (
              <Link
                key={v.href}
                href={v.href}
                aria-current={v.active ? "page" : undefined}
                className={v.active ? "rounded-full bg-white px-3 py-1 text-accent-ink" : "rounded-full px-3 py-1 hover:bg-white/10"}
              >
                {v.label}
              </Link>
            ))}
          </span>
        )}
        <a href={editHref} className="underline underline-offset-4">
          Back to editor
        </a>
      </div>
    </>
  );
}
