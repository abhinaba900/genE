import Image from "next/image";
import { cn } from "@/lib/cn";
import type { ArticleBlock, RichText } from "@/lib/content/types";
import { Reveal } from "@/components/motion/Reveal";
import { ArticleMedia } from "./ArticleMedia";

/** Inline rich text as React elements — formatting and links only; there is no raw-HTML path. */
export function Inline({ content }: { content: RichText }) {
  return (
    <>
      {content.map((node, i) => {
        if (node.type === "break") return <br key={i} />;
        if (node.type === "link") {
          const external = /^https?:/.test(node.href);
          return (
            <a
              key={i}
              href={node.href}
              target={node.newTab ? "_blank" : undefined}
              rel={external ? `noopener noreferrer${node.newTab ? "" : " nofollow"}`.trim() : undefined}
              className="underline decoration-ink/30 underline-offset-4 transition-colors hover:decoration-accent"
            >
              <Inline content={node.children} />
            </a>
          );
        }
        let el: React.ReactNode = node.text;
        if (node.code) el = <code className="rounded bg-paper-2 px-1 font-mono text-[0.88em]">{el}</code>;
        if (node.bold) el = <strong className="font-semibold text-ink">{el}</strong>;
        if (node.italic) el = <em>{el}</em>;
        if (node.underline) el = <u>{el}</u>;
        if (node.strike) el = <s>{el}</s>;
        return <span key={i}>{el}</span>;
      })}
    </>
  );
}

/**
 * Renders CMS-style content blocks as semantic, server-rendered HTML.
 * Add new block types to `ArticleBlock` and handle them here.
 */
export function ArticleBody({ blocks, title }: { blocks: ArticleBlock[]; title: string }) {
  const firstParagraph = blocks.findIndex((b) => b.type === "paragraph");
  return (
    <div className="prose-article px-5 md:px-8">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p key={i} className={cn("mx-auto max-w-[680px]", i === firstParagraph && "lead")}>
                <Inline content={block.content} />
              </p>
            );
          case "heading": {
            const H = block.level === 3 ? "h3" : "h2";
            return (
              <H
                key={i}
                className={cn(
                  "mx-auto mb-4 mt-14 max-w-[680px] font-serif tracking-[-0.015em] text-ink",
                  H === "h2" ? "text-[30px] leading-[1.12] md:text-[34px]" : "text-[24px] leading-tight",
                )}
              >
                <Inline content={block.content} />
              </H>
            );
          }
          case "image": {
            const portrait = block.image.height > block.image.width;
            const wide = block.layout === "wide" && !portrait;
            return (
              <Reveal
                as="figure"
                key={i}
                className={cn(
                  "my-12",
                  wide ? "max-w-[1040px] max-md:-mx-5 md:mx-auto" : portrait ? "mx-auto max-w-[380px]" : "mx-auto max-w-[680px]",
                )}
              >
                <div
                  className={cn("relative overflow-hidden bg-paper-2", wide ? "md:rounded-2xl" : "rounded-xl")}
                  style={{ aspectRatio: `${block.image.width} / ${block.image.height}`, maxHeight: "80vh" }}
                >
                  <Image
                    src={block.image.src}
                    alt={block.image.alt}
                    fill
                    sizes={wide ? "(min-width: 1080px) 1040px, 100vw" : portrait ? "380px" : "(min-width: 720px) 680px, 100vw"}
                    className="object-cover"
                  />
                </div>
                {(block.caption || block.image.credit) && (
                  <figcaption className={cn("mx-auto mt-3 font-sans text-[13px] leading-relaxed text-muted", portrait ? "" : "max-w-[680px] max-md:px-5")}>
                    {block.caption}
                    {block.image.credit && !block.caption?.includes(block.image.credit) && (
                      <span className="text-muted/70"> Credit: {block.image.credit}.</span>
                    )}
                  </figcaption>
                )}
              </Reveal>
            );
          }
          case "quote":
            return (
              <Reveal as="figure" key={i} className="mx-auto my-14 max-w-[760px] border-l-2 border-accent pl-6 md:pl-10">
                <blockquote className="font-serif text-[28px] italic leading-[1.22] tracking-[-0.01em] text-ink md:text-[36px]">
                  <p>“{block.text}”</p>
                </blockquote>
                {block.attribution && (
                  <figcaption className="mt-5 font-sans text-[13px] uppercase tracking-[0.12em] text-muted">
                    — {block.attribution}
                  </figcaption>
                )}
              </Reveal>
            );
          case "list": {
            const L = block.style === "number" ? "ol" : "ul";
            return (
              <L
                key={i}
                className={cn(
                  "mx-auto my-8 max-w-[680px] space-y-3 pl-6",
                  block.style === "number" ? "list-decimal marker:font-sans marker:text-[0.8em] marker:text-accent" : "list-disc marker:text-accent",
                )}
              >
                {block.items.map((item, j) => (
                  <li key={j} className="pl-2">
                    <Inline content={item} />
                  </li>
                ))}
              </L>
            );
          }
          case "blockquote":
            return (
              <blockquote key={i} className="mx-auto my-8 max-w-[680px] border-l-2 border-ink/20 pl-5 italic text-ink/80">
                <p>
                  <Inline content={block.content} />
                </p>
              </blockquote>
            );
          case "divider":
            return <hr key={i} className="mx-auto my-12 max-w-[120px] border-0 border-t border-ink/20" />;
          case "embed":
            return (
              <figure key={i} className="mx-auto my-12 max-w-[760px]">
                {block.embedUrl ? (
                  <div className="relative aspect-video overflow-hidden rounded-xl bg-ink">
                    <iframe
                      src={block.embedUrl}
                      title={block.title ?? "Embedded video"}
                      loading="lazy"
                      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                      referrerPolicy="strict-origin-when-cross-origin"
                      sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                      className="absolute inset-0 size-full border-0"
                    />
                  </div>
                ) : (
                  <a
                    href={block.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="block rounded-xl px-5 py-4 font-sans text-[15px] ring-1 ring-ink/12 transition-colors hover:bg-paper-2"
                  >
                    <span className="block font-medium text-ink">{block.title ?? new URL(block.url).hostname}</span>
                    <span className="block truncate text-[13px] text-muted">{block.url}</span>
                  </a>
                )}
                {block.caption && <figcaption className="mt-3 font-sans text-[13px] text-muted">{block.caption}</figcaption>}
              </figure>
            );
          case "video":
            return (
              <figure key={i} className="mx-auto my-12 max-w-[420px]">
                <ArticleMedia video={block.video} title={block.caption ?? title} className="aspect-[9/16] rounded-2xl" />
                {block.caption && (
                  <figcaption className="mt-3 font-sans text-[13px] text-muted">{block.caption}</figcaption>
                )}
              </figure>
            );
        }
      })}
    </div>
  );
}
