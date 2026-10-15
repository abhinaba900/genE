"use client";

import { Check, Link2, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { absoluteUrl } from "@/lib/site";

type Variant = "overlay" | "solid" | "ghost";

/**
 * Shares a story with the native Web Share API where available,
 * falling back to copying the link to the clipboard.
 */
export function ShareButton({
  path,
  title,
  text,
  variant = "solid",
  label = "Share",
  showLabel = true,
  className,
}: {
  path: string;
  title: string;
  text?: string;
  variant?: Variant;
  label?: string;
  showLabel?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function share() {
    const url = absoluteUrl(path);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Older browsers / insecure contexts: fall back to a temporary input.
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2200);
  }

  const Icon = copied ? Check : variant === "ghost" ? Link2 : Share2;
  const live = (
    <span className="sr-only" aria-live="polite">
      {copied ? "Link copied to clipboard" : ""}
    </span>
  );

  if (variant === "overlay") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          share();
        }}
        aria-label={`${label}: ${title}`}
        className={cn("group flex flex-col items-center gap-1.5 text-white", className)}
      >
        <span className="flex size-12 items-center justify-center rounded-full bg-black/25 ring-1 ring-white/15 transition-transform duration-200 group-active:scale-90">
          <Icon className="size-[21px]" strokeWidth={1.6} />
        </span>
        <span className="text-[11px] font-medium tracking-wide text-white/85" aria-hidden>
          {copied ? "Copied" : label}
        </span>
        {live}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={share}
      aria-label={showLabel ? undefined : label}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-medium transition-all duration-200 active:scale-[0.97]",
        variant === "solid" && "bg-ink px-5 text-white hover:bg-ink-2",
        variant === "ghost" && "px-4 text-ink ring-1 ring-ink/15 hover:bg-ink/5",
        !showLabel && "w-11 justify-center px-0",
        className,
      )}
    >
      <Icon className="size-4" strokeWidth={1.8} />
      {showLabel && <span>{copied ? "Link copied" : label}</span>}
      {live}
    </button>
  );
}
