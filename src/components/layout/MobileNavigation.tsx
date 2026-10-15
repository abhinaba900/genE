"use client";

import { AnimatePresence, LazyMotion, domAnimation, m } from "motion/react";
import { ArrowUpRight, Menu, Search, X } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Wordmark } from "@/components/brand/Wordmark";
import { cn } from "@/lib/cn";
import { setOverlayOpen } from "@/lib/overlay";
import type { NavData } from "./nav";

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
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }, []);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
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
      <Drawer open={open} onClose={close} nav={nav} />
    </>
  );
}

const EASE = [0.22, 1, 0.36, 1] as const;

function Drawer({ open, onClose, nav }: { open: boolean; onClose: () => void; nav: NavData }) {
  const pathname = usePathname();
  const panel = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    setOverlayOpen(true);
    const onKey = (e: KeyboardEvent) => {
      // Keep keyboard shortcuts (e.g. the video feed's) from firing behind the dialog.
      e.stopPropagation();
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && panel.current) {
        const focusables = panel.current.querySelectorAll<HTMLElement>("a[href], button, input");
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey, true);
    const raf = requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus());
    return () => {
      cancelAnimationFrame(raf);
      root.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey, true);
      setOverlayOpen(false);
    };
  }, [open, onClose]);

  if (!mounted) return null;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return createPortal(
    <LazyMotion features={domAnimation} strict>
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-[60]" onClick={(e) => e.stopPropagation()}>
            <m.div
              className="absolute inset-0 bg-black/55"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              onClick={onClose}
              aria-hidden
            />
            <m.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-label="Site menu"
              className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col overflow-y-auto overscroll-contain bg-ink text-white pt-safe pb-safe"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", ease: EASE, duration: 0.45 }}
            >
              <div className="flex items-center justify-between px-5 pt-3">
                <Wordmark className="h-8" />
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close menu"
                  className="flex size-11 items-center justify-center rounded-full text-white hover:bg-white/10"
                >
                  <X className="size-6" strokeWidth={1.6} />
                </button>
              </div>

              <Form action="/search" role="search" className="mx-5 mt-6" onSubmit={onClose}>
                <label htmlFor="drawer-search" className="sr-only">
                  Search stories
                </label>
                <div className="flex h-12 items-center gap-3 rounded-full bg-white/[0.08] px-4 ring-1 ring-white/10 focus-within:ring-white/40">
                  <Search className="size-[18px] shrink-0 text-white/60" strokeWidth={1.8} aria-hidden />
                  <input
                    id="drawer-search"
                    name="q"
                    type="search"
                    placeholder="Search stories, topics, tags"
                    className="h-full w-full bg-transparent text-[16px] text-white placeholder:text-white/45 focus:outline-none"
                  />
                </div>
              </Form>

              <nav aria-label="Main" className="mt-7 px-5">
                <ul>
                  {nav.primary.map((link, i) => (
                    <m.li
                      key={link.href}
                      initial={{ opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 + i * 0.045, duration: 0.45, ease: EASE }}
                    >
                      <Link
                        href={link.href}
                        onClick={onClose}
                        data-autofocus={i === 0 ? true : undefined}
                        aria-current={isActive(link.href) ? "page" : undefined}
                        className="group flex min-h-[60px] items-center justify-between border-b border-white/10 font-serif text-[30px] leading-none tracking-tight"
                      >
                        <span className={cn(isActive(link.href) && "italic")}>{link.label}</span>
                        <ArrowUpRight
                          className="size-5 text-white/30 transition-colors group-hover:text-accent"
                          strokeWidth={1.6}
                          aria-hidden
                        />
                      </Link>
                    </m.li>
                  ))}
                </ul>
              </nav>

              <section aria-labelledby="drawer-categories" className="mt-9 px-5">
                <h2 id="drawer-categories" className="kicker text-white/45">
                  Categories
                </h2>
                <ul className="mt-4 grid grid-cols-2 gap-2">
                  {nav.categories.map((c) => {
                    const href = `/category/${c.slug}`;
                    const active = pathname === href;
                    return (
                      <li key={c.slug}>
                        <Link
                          href={href}
                          onClick={onClose}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex min-h-12 items-center rounded-xl px-4 text-[15px] transition-colors",
                            active ? "bg-white text-ink" : "bg-white/[0.06] hover:bg-white/[0.12]",
                          )}
                        >
                          {c.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <nav aria-label="More" className="mt-8 px-5">
                <ul>
                  {nav.secondary.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        onClick={onClose}
                        className="flex min-h-11 items-center text-[17px] text-white/80 hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>

              <div className="mt-auto px-5 pb-6 pt-10">
                <p className="font-serif text-lg italic text-white/55">{nav.tagline}</p>
                <ul className="mt-3 flex gap-5 text-[13px] text-white/45">
                  {nav.legal.map((l) => (
                    <li key={l.href}>
                      <Link href={l.href} onClick={onClose} className="inline-flex min-h-11 items-center hover:text-white">
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </m.div>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>,
    document.body,
  );
}
