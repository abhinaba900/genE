"use client";

import { Menu } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import type { NavData } from "./nav";

// Loaded on first intent (hover, focus or touch on the button) instead of with the page.
const Drawer = dynamic(() => import("./MobileDrawer").then((m) => m.Drawer), { ssr: false });

/** Menu trigger + slide-in navigation drawer. */
export function MobileNavigation({
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
  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }, []);

  // Warm the chunk once the page has settled, so even a first tap opens instantly.
  useEffect(() => {
    const t = window.setTimeout(() => void import("./MobileDrawer"), 4000);
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
          setArmed(true);
          setOpen(true);
        }}
        aria-label="Open menu"
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "flex size-11 items-center justify-center rounded-full transition active:scale-95",
          tone === "dark" ? "text-white hover:bg-white/10" : "text-ink hover:bg-ink/5",
          className,
        )}
      >
        <Menu className="size-[22px]" strokeWidth={1.7} />
      </button>
      {armed && <Drawer open={open} onClose={close} nav={nav} />}
    </>
  );
}
