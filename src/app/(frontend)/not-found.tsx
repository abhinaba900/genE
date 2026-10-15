import Link from "next/link";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="mx-auto flex min-h-[70vh] max-w-[1680px] flex-col justify-center px-5 py-20 md:px-8 xl:px-12">
        <p className="kicker text-muted">Error 404</p>
        <h1 className="mt-6 max-w-[14ch] font-serif text-[clamp(3rem,2rem+5vw,6.5rem)] leading-[0.95] tracking-[-0.03em] text-ink">
          This story <em>isn’t</em> here.
        </h1>
        <p className="mt-6 max-w-md text-[17px] leading-relaxed text-muted">
          The page may have moved, or the link might be mistyped. There’s plenty more to watch and read.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/" className="inline-flex h-12 items-center rounded-full bg-ink px-6 text-[15px] font-medium text-white hover:bg-ink-2">
            Back to the homepage
          </Link>
          <Link href="/search" className="inline-flex h-12 items-center rounded-full px-6 text-[15px] font-medium text-ink ring-1 ring-ink/15 hover:bg-ink/5">
            Search stories
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
