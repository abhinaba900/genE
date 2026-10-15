"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/** Sticky header container — adds a hairline once the page scrolls. */
export function HeaderShell({ children }: { children: React.ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header
      className={cn(
        "sticky top-0 z-40 bg-paper pt-safe transition-[border-color,box-shadow] duration-300",
        "border-b",
        scrolled ? "border-line" : "border-transparent",
      )}
    >
      {children}
    </header>
  );
}
