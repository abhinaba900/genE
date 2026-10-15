import { Play, Search } from "lucide-react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { CategoryMenu, DesktopNavigation } from "./DesktopNavigation";
import { HeaderShell } from "./HeaderShell";
import { SearchSheet } from "@/components/search/SearchSheet";
import { MobileNavigation } from "./MobileNavigation";
import { getNavData } from "./getNavData";

/** Sticky editorial header used across reading pages and the desktop homepage. */
export async function SiteHeader() {
  const nav = await getNavData();
  return (
    <HeaderShell>
      <div className="mx-auto flex h-16 max-w-[1680px] items-center justify-between gap-6 px-4 md:h-[72px] md:px-8 xl:px-12">
        <div className="flex min-w-0 items-center gap-6 xl:gap-8">
          <Wordmark className="h-8 md:h-9" priority />
          <DesktopNavigation nav={nav} />
        </div>
        <div className="flex items-center gap-1 md:gap-2">
          <Link
            href="/search"
            className="hidden h-10 shrink-0 items-center gap-2 rounded-full px-4 text-ink ring-1 ring-ink/12 transition-colors hover:bg-ink/5 lg:flex"
          >
            <Search className="size-4" strokeWidth={1.8} aria-hidden />
            <span className="whitespace-nowrap text-[13px] text-muted">Search stories</span>
          </Link>
          {/* Phones & tablets: in-place search sheet instead of a page change. */}
          <SearchSheet nav={nav} className="lg:hidden" />
          <Link
            href="/watch"
            className="hidden h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-ink px-4 text-[13px] font-medium text-white transition-colors hover:bg-ink-2 md:inline-flex"
          >
            <Play className="size-3.5 fill-current" aria-hidden />
            Watch the reel
          </Link>
          {/* Phones and tablets use the drawer; full links appear from lg. */}
          <MobileNavigation nav={nav} className="lg:hidden" />
        </div>
      </div>
      <div className="mx-auto hidden max-w-[1680px] border-t border-line px-8 md:block xl:px-12">
        <CategoryMenu nav={nav} />
      </div>
    </HeaderShell>
  );
}
