"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { NavData } from "./nav";

/** Primary links shown in the desktop header row. */
export function DesktopNavigation({ nav }: { nav: NavData }) {
  const pathname = usePathname();
  const links = nav.primary.filter((l) => l.href !== "/");
  return (
    <nav aria-label="Main" className="hidden lg:block">
      <ul className="flex items-center gap-1">
        {links.map((link) => {
          const active = pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center whitespace-nowrap rounded-full px-3 text-[14px] font-medium transition-colors xl:px-3.5",
                  active ? "text-ink" : "text-ink/65 hover:text-ink",
                )}
              >
                {link.label}
                {active && <span aria-hidden className="absolute inset-x-3.5 bottom-1.5 h-px bg-ink" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Horizontal category menu under the desktop header. */
export function CategoryMenu({ nav }: { nav: NavData }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Categories" className="hidden md:block">
      <ul className="flex items-center gap-6 overflow-x-auto scrollbar-none lg:gap-7">
        {nav.categories.map((c) => {
          const href = `/category/${c.slug}`;
          const active = pathname === href;
          return (
            <li key={c.slug}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-11 shrink-0 items-center whitespace-nowrap text-[13px] tracking-wide transition-colors",
                  active ? "text-ink" : "text-muted hover:text-ink",
                )}
              >
                {c.name}
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-[2px] origin-left bg-accent transition-transform duration-300 ease-out-soft",
                    active ? "scale-x-100" : "scale-x-0",
                  )}
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
