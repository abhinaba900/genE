import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Inline } from "@/components/article/ArticleBody";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { ContactForm } from "@/components/ui/ContactForm";
import { cn } from "@/lib/cn";
import type { ArticleBlock, Page, PageBlock } from "@/lib/content/types";

/**
 * Renders a CMS page. Layout comes from the page template; content from a fixed set
 * of blocks, each a presentational section of the existing site design. Editors can
 * add pages without new code, but can't inject arbitrary HTML.
 */
export function PageView({ page }: { page: Page }) {
  const formBlocks = page.template === "contact" ? page.blocks.filter((b) => b.type === "contactForm") : [];
  const blocks = page.template === "contact" ? page.blocks.filter((b) => b.type !== "contactForm") : page.blocks;

  return (
    <>
      <SiteHeader />
      <main id="main">
        {page.template === "contact" ? (
          <div className="mx-auto grid max-w-[1680px] gap-14 px-5 pt-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:gap-20 md:px-8 md:pt-20 xl:px-12">
            <header>
              {page.kicker && <p className="kicker text-muted">{page.kicker}</p>}
              <h1 className="mt-4 font-serif text-display text-ink">{page.title}</h1>
              {page.intro && <p className="mt-6 max-w-md font-serif text-[21px] leading-[1.5] text-ink/70">{page.intro}</p>}
              <Notice text={page.notice} />
              <div className="mt-10 space-y-10">
                {blocks.map((b) => (
                  <Block key={b.id} block={b} pageId={page.id} compact />
                ))}
              </div>
            </header>
            <div className="md:pt-4">
              {formBlocks.map((b) => (
                <Block key={b.id} block={b} pageId={page.id} />
              ))}
            </div>
          </div>
        ) : (
          <>
            {page.template === "feature" ? (
              <header className="mx-auto max-w-[1680px] px-5 pb-16 pt-12 md:px-8 md:pt-24 xl:px-12">
                {page.kicker && <p className="kicker text-muted">{page.kicker}</p>}
                <h1 className="mt-6 max-w-[16ch] font-serif text-[clamp(2.8rem,1.6rem+5vw,6rem)] leading-[0.98] tracking-[-0.03em] text-ink">
                  {page.title}
                </h1>
                {page.intro && <p className="mt-8 max-w-2xl font-serif text-[21px] leading-[1.5] text-ink/70">{page.intro}</p>}
              </header>
            ) : (
              <header className="mx-auto grid max-w-[1680px] gap-6 border-b border-line px-5 pb-12 pt-12 md:grid-cols-[1fr_1fr] md:px-8 md:pt-20 xl:px-12">
                <div>
                  {page.kicker && <p className="kicker text-muted">{page.kicker}</p>}
                  <h1 className="mt-4 font-serif text-display text-ink">{page.title}</h1>
                </div>
                {page.intro && <p className="self-end font-serif text-[21px] leading-[1.5] text-ink/70">{page.intro}</p>}
              </header>
            )}
            {page.notice && (
              <div className="mx-auto max-w-[1680px] px-5 md:px-8 xl:px-12">
                <Notice text={page.notice} />
              </div>
            )}
            {page.heroImage && (
              <figure className="mx-auto mt-10 max-w-[1680px] px-5 md:px-8 xl:px-12">
                <div className="relative overflow-hidden rounded-2xl bg-paper-2" style={{ aspectRatio: `${page.heroImage.width} / ${page.heroImage.height}`, maxHeight: "70vh" }}>
                  <Image src={page.heroImage.src} alt={page.heroImage.alt} fill sizes="100vw" className="object-cover" priority />
                </div>
              </figure>
            )}
            <div className="space-y-24 pt-12 md:pt-16">
              {blocks.map((b) => (
                <Block key={b.id} block={b} pageId={page.id} />
              ))}
            </div>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

function Notice({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p role="note" className="mt-10 max-w-[680px] rounded-xl border border-dashed border-ink/25 px-5 py-4 text-[14px] leading-relaxed text-ink/70">
      {text}
    </p>
  );
}

const wrap = "mx-auto max-w-[1680px] px-5 md:px-8 xl:px-12";

/** Body text inside page sections (lighter than the article renderer). */
function Prose({ blocks, className }: { blocks: ArticleBlock[]; className?: string }) {
  return (
    <div className={cn("space-y-4 font-serif text-[18px] leading-[1.7] text-ink-2", className)}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "paragraph":
            return (
              <p key={i}>
                <Inline content={b.content} />
              </p>
            );
          case "heading":
            return b.level === 3 ? (
              <h3 key={i} className="pt-4 text-[22px] text-ink">
                <Inline content={b.content} />
              </h3>
            ) : (
              <h2 key={i} className="pt-6 text-[26px] text-ink">
                <Inline content={b.content} />
              </h2>
            );
          case "list": {
            const L = b.style === "number" ? "ol" : "ul";
            return (
              <L key={i} className={cn("space-y-2 pl-6", b.style === "number" ? "list-decimal" : "list-disc marker:text-accent")}>
                {b.items.map((item, j) => (
                  <li key={j}>
                    <Inline content={item} />
                  </li>
                ))}
              </L>
            );
          }
          case "blockquote":
            return (
              <blockquote key={i} className="border-l-2 border-ink/20 pl-5 italic">
                <Inline content={b.content} />
              </blockquote>
            );
          case "quote":
            return (
              <blockquote key={i} className="border-l-2 border-accent pl-5 text-[24px] italic text-ink">
                “{b.text}”
              </blockquote>
            );
          case "divider":
            return <hr key={i} className="border-line" />;
          case "image":
            return (
              <figure key={i} className="my-6">
                <div className="relative overflow-hidden rounded-xl bg-paper-2" style={{ aspectRatio: `${b.image.width} / ${b.image.height}` }}>
                  <Image src={b.image.src} alt={b.image.alt} fill sizes="(min-width: 720px) 680px, 100vw" className="object-cover" />
                </div>
                {b.caption && <figcaption className="mt-2 font-sans text-[13px] text-muted">{b.caption}</figcaption>}
              </figure>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}

function Block({ block, pageId, compact = false }: { block: PageBlock; pageId: string; compact?: boolean }) {
  switch (block.type) {
    case "richText":
      return (
        <section className={compact ? "" : wrap}>
          <Prose blocks={block.blocks} className={compact ? "" : "max-w-[680px]"} />
        </section>
      );
    case "sections":
      return (
        <div className={cn(wrap, "grid gap-12")}>
          {block.items.map((s, i) => (
            <section key={s.heading} aria-labelledby={`${block.id}-${i}`} className="grid gap-4 md:grid-cols-[280px_minmax(0,680px)] md:gap-12">
              <h2 id={`${block.id}-${i}`} className="font-serif text-[24px] leading-tight text-ink">
                <span aria-hidden className="mr-3 font-sans text-[12px] tabular-nums text-muted">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {s.heading}
              </h2>
              <Prose blocks={s.blocks} />
            </section>
          ))}
        </div>
      );
    case "twoColumn":
      return (
        <section aria-labelledby={block.id} className={cn(wrap, "grid gap-8 md:grid-cols-[280px_minmax(0,1fr)] md:gap-12")}>
          <h2 id={block.id} className="font-serif text-[30px] leading-tight text-ink">
            {block.heading}
          </h2>
          <Prose blocks={block.blocks} className="text-[20px] leading-[1.6] text-ink/75" />
        </section>
      );
    case "pillars":
      return (
        <section aria-label={block.heading ?? undefined} className={wrap}>
          <ol className="grid gap-px overflow-hidden rounded-2xl bg-line md:grid-cols-3">
            {block.items.map((p, i) => (
              <li key={p.title} className="bg-paper p-8">
                <span className="font-serif text-[15px] italic text-accent">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="mt-3 font-serif text-[28px] leading-tight text-ink">{p.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink/70">{p.text}</p>
              </li>
            ))}
          </ol>
        </section>
      );
    case "statement":
      return (
        <section className="bg-ink py-20 text-white">
          <div className={cn(wrap, "grid gap-12", block.items.length > 1 && "md:grid-cols-2")}>
            {block.items.map((item) => (
              <div key={item.label}>
                <h2 className="kicker text-white/50">{item.label}</h2>
                <p className="mt-5 font-serif text-[30px] leading-[1.2] md:text-[38px]">{item.text}</p>
              </div>
            ))}
          </div>
        </section>
      );
    case "storyStrip":
      return (
        <div aria-hidden className={cn(wrap, "grid gap-3 md:gap-5")} style={{ gridTemplateColumns: `repeat(${Math.max(1, block.stories.length)}, minmax(0, 1fr))` }}>
          {block.stories.map((s, i) => (
            <div key={s.id} className="relative aspect-[9/16] overflow-hidden rounded-xl bg-ink md:rounded-2xl" style={{ transform: `translateY(${i % 2 ? 24 : 0}px)` }}>
              <Image src={s.video.poster} alt="" fill sizes="25vw" className="object-cover" />
            </div>
          ))}
        </div>
      );
    case "image":
      return (
        <figure className={wrap}>
          <div className="relative overflow-hidden rounded-2xl bg-paper-2" style={{ aspectRatio: `${block.image.width} / ${block.image.height}`, maxHeight: "80vh" }}>
            <Image src={block.image.src} alt={block.image.alt} fill sizes="100vw" className="object-cover" />
          </div>
          {block.caption && <figcaption className="mt-3 text-[13px] text-muted">{block.caption}</figcaption>}
        </figure>
      );
    case "callToAction": {
      const external = /^https?:/.test(block.href);
      return (
        <section className={cn(wrap, "flex flex-col items-start justify-between gap-6 md:flex-row md:items-center")}>
          <p className="max-w-xl font-serif text-[26px] leading-snug text-ink">{block.text}</p>
          <Link
            href={block.href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-ink pl-6 pr-5 text-[15px] font-medium text-white hover:bg-ink-2"
          >
            {block.label}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </Link>
        </section>
      );
    }
    case "contactDetails":
      return (
        <dl className={cn("space-y-5 text-[15px]", !compact && wrap)}>
          {block.items.map((item) => (
            <div key={item.label}>
              <dt className="kicker text-ink/50">{item.label}</dt>
              <dd className="mt-1 text-ink">
                {item.href ? (
                  <a href={item.href} className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
                    {item.value}
                  </a>
                ) : (
                  item.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      );
    case "contactForm":
      return (
        <div className={compact ? "" : cn(wrap, "max-w-[820px]")}>
          <ContactForm
            pageId={pageId}
            blockId={block.id}
            heading={block.heading}
            intro={block.intro}
            submitLabel={block.submitLabel}
            successMessage={block.successMessage}
            fields={block.fields}
          />
        </div>
      );
  }
}
