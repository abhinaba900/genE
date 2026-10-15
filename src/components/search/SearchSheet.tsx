"use client";

import { Search } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { NavData } from "@/components/layout/nav";
import { cn } from "@/lib/cn";

// Loaded on first intent (hover, focus or touch on the button) instead of with the page.
const Sheet = dynamic(() => import("./SearchSheetPanel").then((m) => m.Sheet), { ssr: false });

/**
 * Search for phones and tablets: a button that opens an in-place search sheet
 * (full-screen on phones, a floating panel on tablets) with recent searches,
 * topics, trending stories and live results. Desktop keeps the /search page.
 */
export function SearchSheet({
  nav,
  tone = "light",
  className,
}: {
  nav: NavData;
  tone?: "light" | "dark";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [armed, setArmed] = useState(false);
  const arm = () => setArmed(true);
  const trigger = useRef<HTMLButtonElement>(null);

  const openSheet = () => {
    // iOS only shows the keyboard if an input is focused inside the tap handler itself.
    // Focus a throwaway input now; the sheet's real input takes over focus once mounted.
    const proxy = document.createElement("input");
    proxy.setAttribute("aria-hidden", "true");
    proxy.style.cssText = "position:fixed;top:0;left:0;opacity:0;height:0;font-size:16px;";
    document.body.appendChild(proxy);
    proxy.focus();
    window.setTimeout(() => proxy.remove(), 1000);
    setArmed(true);
    setOpen(true);
  };

  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }, []);

  // Warm the chunk once the page has settled, so even a first tap opens instantly.
  useEffect(() => {
    const t = window.setTimeout(() => void import("./SearchSheetPanel"), 4000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onPointerEnter={arm}
        onFocus={arm}
        onTouchStart={arm}
        onClick={(e) => {
          e.stopPropagation();
          openSheet();
        }}
        aria-label="Search stories"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "flex size-11 items-center justify-center rounded-full transition active:scale-95",
          tone === "dark" ? "text-white hover:bg-white/10" : "text-ink hover:bg-ink/5",
          className,
        )}
      >
        <Search className="size-[21px]" strokeWidth={1.7} aria-hidden />
      </button>
      {armed && <Sheet open={open} onClose={close} nav={nav} />}
    </>
  );
}
