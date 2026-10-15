import type { ArticleBlock, InlineNode, RichText } from "../types";
import { categoryPath, storyPath } from "@/lib/site";
import { toImage, toVideo } from "./map";

/**
 * Converts Payload's Lexical JSON into gen.E's typed article blocks.
 *
 * Only known node types are emitted; anything else is dropped. Links are restricted
 * to http(s), mailto, tel and site-relative paths, and embeds are rebuilt from a parsed
 * video id — so stored content can never inject markup or script into the page.
 */
type LexicalNode = { type: string; [key: string]: any };

const FORMAT = { bold: 1, italic: 2, strike: 4, underline: 8, code: 16 } as const;

export function safeHref(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const href = raw.trim();
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (href.startsWith("#")) return href;
  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

function linkHref(fields: Record<string, any> | undefined): string | null {
  if (!fields) return null;
  if (fields.linkType === "internal" && fields.doc?.value && typeof fields.doc.value === "object") {
    const { relationTo, value } = fields.doc;
    if (relationTo === "stories" && value.slug) return storyPath(value.slug);
    if (relationTo === "pages" && value.slug) return `/${value.slug}`;
    if (relationTo === "categories" && value.slug) return categoryPath(value.slug);
    return null;
  }
  return safeHref(fields.url);
}

function inline(children: LexicalNode[] | undefined): RichText {
  const out: InlineNode[] = [];
  for (const child of children ?? []) {
    if (child.type === "text" && typeof child.text === "string") {
      const f = Number(child.format) || 0;
      out.push({
        type: "text",
        text: child.text,
        ...(f & FORMAT.bold ? { bold: true } : {}),
        ...(f & FORMAT.italic ? { italic: true } : {}),
        ...(f & FORMAT.underline ? { underline: true } : {}),
        ...(f & FORMAT.strike ? { strike: true } : {}),
        ...(f & FORMAT.code ? { code: true } : {}),
      });
    } else if (child.type === "linebreak") {
      out.push({ type: "break" });
    } else if (child.type === "link" || child.type === "autolink") {
      const href = linkHref(child.fields);
      const inner = inline(child.children);
      if (href) out.push({ type: "link", href, newTab: Boolean(child.fields?.newTab), children: inner });
      else out.push(...inner);
    } else if (Array.isArray(child.children)) {
      out.push(...inline(child.children));
    }
  }
  return out;
}

export function richTextToPlain(content: RichText): string {
  return content
    .map((n) => (n.type === "text" ? n.text : n.type === "link" ? richTextToPlain(n.children) : " "))
    .join("");
}

const isEmpty = (content: RichText) => richTextToPlain(content).trim().length === 0;

function listItems(list: LexicalNode): RichText[] {
  const items: RichText[] = [];
  for (const item of list.children ?? []) {
    const nested = (item.children ?? []).filter((c: LexicalNode) => c.type === "list");
    const own = inline((item.children ?? []).filter((c: LexicalNode) => c.type !== "list"));
    if (!isEmpty(own)) items.push(own);
    // Nested lists are flattened into the parent list; gen.E articles use one level.
    for (const sub of nested) items.push(...listItems(sub));
  }
  return items;
}

export function embedFromUrl(url: string): Pick<Extract<ArticleBlock, { type: "embed" }>, "provider" | "embedUrl"> {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    let yt: string | null = null;
    if (host === "youtu.be") yt = u.pathname.slice(1);
    else if (host.endsWith("youtube.com")) yt = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([\w-]+)/)?.[1] ?? null;
    if (yt && /^[\w-]{6,20}$/.test(yt)) return { provider: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${yt}` };
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = u.pathname.match(/(\d{5,})/)?.[1];
      if (id) return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}?dnt=1` };
    }
  } catch {
    /* fall through */
  }
  return { provider: "link" };
}

export function lexicalToBlocks(state: unknown): ArticleBlock[] {
  const root = (state as { root?: LexicalNode } | null)?.root;
  if (!root) return [];
  const blocks: ArticleBlock[] = [];

  for (const node of (root.children ?? []) as LexicalNode[]) {
    switch (node.type) {
      case "paragraph": {
        const content = inline(node.children);
        if (!isEmpty(content)) blocks.push({ type: "paragraph", content });
        break;
      }
      case "heading": {
        const content = inline(node.children);
        if (!isEmpty(content)) blocks.push({ type: "heading", content, level: node.tag === "h3" || node.tag === "h4" ? 3 : 2 });
        break;
      }
      case "quote": {
        const content = inline(node.children);
        if (!isEmpty(content)) blocks.push({ type: "blockquote", content });
        break;
      }
      case "list": {
        const items = listItems(node);
        if (items.length) blocks.push({ type: "list", style: node.listType === "number" ? "number" : "bullet", items });
        break;
      }
      case "horizontalrule":
        blocks.push({ type: "divider" });
        break;
      case "upload": {
        if (node.relationTo !== "media" || typeof node.value !== "object" || !node.value) break;
        const image = toImage(node.value);
        if (!image) break;
        blocks.push({
          type: "image",
          image,
          caption: node.fields?.caption || node.value.caption || undefined,
          layout: node.fields?.layout === "wide" ? "wide" : "inline",
        });
        break;
      }
      case "block": {
        const f = node.fields ?? {};
        if (f.blockType === "pullQuote" && f.text) {
          blocks.push({ type: "quote", text: String(f.text), attribution: f.attribution || undefined });
        } else if (f.blockType === "embed" && f.url) {
          const href = safeHref(f.url);
          if (href) blocks.push({ type: "embed", url: href, title: f.title || undefined, caption: f.caption || undefined, ...embedFromUrl(href) });
        } else if (f.blockType === "video" && typeof f.video === "object" && f.video) {
          const video = toVideo(f.video);
          if (video) blocks.push({ type: "video", video, caption: f.caption || undefined });
        }
        break;
      }
    }
  }
  return blocks;
}

const WORDS_PER_MINUTE = 220;

export function readingTime(blocks: ArticleBlock[]) {
  let words = 0;
  const count = (text: string) => (words += text.split(/\s+/).filter(Boolean).length);
  for (const b of blocks) {
    if (b.type === "paragraph" || b.type === "heading" || b.type === "blockquote") count(richTextToPlain(b.content));
    else if (b.type === "quote") count(b.text);
    else if (b.type === "list") b.items.forEach((i) => count(richTextToPlain(i)));
  }
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
