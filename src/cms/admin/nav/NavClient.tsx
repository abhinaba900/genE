"use client";

import {
  Activity,
  BarChart3,
  CalendarClock,
  Compass,
  ClipboardCheck,
  ExternalLink,
  FileText,
  Film,
  FolderTree,
  Hash,
  Home,
  Inbox,
  Image as ImageIcon,
  LayoutDashboard,
  Menu,
  Newspaper,
  PenLine,
  Plus,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { DrawerButton } from "../drawers/DrawerButton";
import { TOUR_EVENT } from "../tour/AdminTour";

const ICONS = {
  dashboard: LayoutDashboard,
  stories: Newspaper,
  create: Plus,
  drafts: PenLine,
  review: ClipboardCheck,
  scheduled: CalendarClock,
  categories: FolderTree,
  tags: Hash,
  authors: UserRound,
  videos: Film,
  media: ImageIcon,
  homepage: Home,
  pages: FileText,
  inbox: Inbox,
  navigation: Menu,
  settings: Settings,
  external: ExternalLink,
  analytics: BarChart3,
  team: Users,
  activity: Activity,
  profile: ShieldCheck,
} as const;

export interface NavItem {
  label: string;
  href: string;
  icon: keyof typeof ICONS;
  badge?: number;
  exact?: boolean;
  external?: boolean;
  /** Open this collection's create form in a drawer instead of navigating. */
  drawer?: string;
  /** Active when the list is filtered by this workflow status (or not filtered at all). */
  match?: { pathname?: string; query?: string; param?: string; noQuery?: string };
}
export interface NavSection {
  label: string;
  items: NavItem[];
}

export function NavClient({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The server renders this nav without the query string, so filter-based highlights are
  // applied only after hydration; otherwise aria-current would differ and React would warn.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const params = hydrated ? searchParams : new URLSearchParams();
  const status = params.get("where[workflowStatus][equals]");

  const isActive = (item: NavItem) => {
    const path = item.href.split("?")[0];
    if (item.match?.query) return pathname === path && status === item.match.query;
    if (item.match?.param) return pathname === path && params.has(item.match.param);
    // Unfiltered list: active only when no where[...] filter is applied.
    if (item.match?.noQuery) return pathname === path && ![...params.keys()].some((k) => k.startsWith(`${item.match!.noQuery}[`));
    if (item.exact) return pathname === path;
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  return (
    <div className="gene-nav__sections">
      {sections.map((section) => (
        <div key={section.label} className="gene-nav__section" data-tour={`nav-${section.label.toLowerCase()}`}>
          <p className="gene-nav__heading">{section.label}</p>
          <ul>
            {section.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(item);
              const content = (
                <>
                  <Icon aria-hidden size={17} strokeWidth={1.8} />
                  <span>{item.label}</span>
                  {item.badge ? <span className="gene-nav__badge">{item.badge}</span> : null}
                </>
              );
              return (
                <li key={item.href}>
                  {item.drawer ? (
                    <DrawerButton collection={item.drawer} className="gene-nav__link">
                      {content}
                    </DrawerButton>
                  ) : (
                    <Link
                      href={item.href}
                      className="gene-nav__link"
                      aria-current={active ? "page" : undefined}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener" : undefined}
                      prefetch={false}
                    >
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
            {section.label === "Overview" && (
              <li>
                <button type="button" className="gene-nav__link" data-tour="tour-button" onClick={() => window.dispatchEvent(new Event(TOUR_EVENT))}>
                  <Compass aria-hidden size={17} strokeWidth={1.8} />
                  <span>Take the tour</span>
                </button>
              </li>
            )}
          </ul>
        </div>
      ))}
    </div>
  );
}
