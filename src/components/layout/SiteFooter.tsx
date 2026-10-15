import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { getNavData } from "./getNavData";

export async function SiteFooter() {
  const nav = await getNavData();
  return (
    <footer className="mt-24 bg-ink text-white pb-safe">
      <div className="mx-auto max-w-[1680px] px-5 pb-10 pt-16 md:px-8 xl:px-12">
        <div className="grid gap-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <Wordmark className="h-12" />
            <p className="mt-4 max-w-xs font-serif text-xl italic leading-snug text-white/70">{nav.tagline}</p>
          </div>
          <FooterColumn title="Explore" links={nav.primary} />
          <FooterColumn
            title="Categories"
            links={nav.categories.map((c) => ({ label: c.name, href: `/category/${c.slug}` }))}
          />
          <FooterColumn title="gen.E" links={[...nav.secondary, ...nav.legal]} />
        </div>
        <div className="mt-16 flex flex-col gap-3 border-t border-white/10 pt-6 text-[12px] text-white/65 md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {nav.footer.copyright || "gen.E"}.
          </p>
          {nav.footer.socials.length > 0 && (
            <ul aria-label="gen.E elsewhere" className="flex flex-wrap gap-x-5 gap-y-1">
              {nav.footer.socials.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="capitalize text-white/65 hover:text-white">
                    {s.platform === "x" ? "X" : s.platform}
                  </a>
                </li>
              ))}
            </ul>
          )}
          {nav.footer.text && <p>{nav.footer.text}</p>}
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <nav aria-label={title}>
      <h2 className="kicker text-white/65">{title}</h2>
      <ul className="mt-4 space-y-1">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="inline-flex min-h-9 items-center text-[15px] text-white/80 transition-colors hover:text-white">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
