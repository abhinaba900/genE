import { describe, expect, it } from "vitest";
import { orderFeed } from "@/lib/content/payload/feed";
import { embedFromUrl, lexicalToBlocks, safeHref } from "@/lib/content/payload/lexical";
import type { StorySummary } from "@/lib/content/types";

const story = (id: string, featured = false) => ({ id, featured }) as StorySummary;

describe("feed ordering", () => {
  const newestFirst = [story("5"), story("4", true), story("3"), story("2", true), story("1")];

  it("latest: pinned first, then newest", () => {
    expect(orderFeed(newestFirst, "latest", ["3"], []).map((s) => s.id)).toEqual(["3", "5", "4", "2", "1"]);
  });
  it("featured first, then the rest by date", () => {
    expect(orderFeed(newestFirst, "featured_first", [], []).map((s) => s.id)).toEqual(["4", "2", "5", "3", "1"]);
  });
  it("curated order, then remaining stories newest first", () => {
    expect(orderFeed(newestFirst, "curated", ["1"], ["2", "5"]).map((s) => s.id)).toEqual(["1", "2", "5", "4", "3"]);
  });
  it("ignores curated ids that aren't public (unpublished/archived/hidden)", () => {
    expect(orderFeed(newestFirst, "curated", ["99"], ["42", "3"]).map((s) => s.id)).toEqual(["3", "5", "4", "2", "1"]);
  });
});

describe("rich text safety", () => {
  it("allows only safe link protocols", () => {
    expect(safeHref("javascript:alert(1)")).toBeNull();
    expect(safeHref("data:text/html,<script>")).toBeNull();
    expect(safeHref("//evil.example")).toBeNull();
    expect(safeHref("/latest")).toBe("/latest");
    expect(safeHref("https://gen-e.in/x")).toBe("https://gen-e.in/x");
    expect(safeHref("mailto:hi@gen-e.in")).toBe("mailto:hi@gen-e.in");
  });

  it("rebuilds embeds from ids, never trusting the pasted URL", () => {
    expect(embedFromUrl("https://www.youtube.com/watch?v=abc123XYZ_-")).toEqual({ provider: "youtube", embedUrl: "https://www.youtube-nocookie.com/embed/abc123XYZ_-" });
    expect(embedFromUrl("https://youtube.com/shorts/MFdfQXh7Kx8").provider).toBe("youtube");
    expect(embedFromUrl("https://vimeo.com/123456789")).toEqual({ provider: "vimeo", embedUrl: "https://player.vimeo.com/video/123456789?dnt=1" });
    expect(embedFromUrl("https://example.com/<script>")).toEqual({ provider: "link" });
  });

  it("converts Lexical into typed blocks and drops unknown/unsafe nodes", () => {
    const blocks = lexicalToBlocks({
      root: {
        type: "root",
        children: [
          { type: "heading", tag: "h2", children: [{ type: "text", text: "Heading", format: 0 }] },
          {
            type: "paragraph",
            children: [
              { type: "text", text: "Bold", format: 1 },
              { type: "link", fields: { url: "javascript:alert(1)" }, children: [{ type: "text", text: " unsafe", format: 0 }] },
              { type: "link", fields: { url: "https://ok.example", newTab: true }, children: [{ type: "text", text: " ok", format: 2 }] },
            ],
          },
          { type: "html", value: "<script>alert(1)</script>" },
          { type: "list", listType: "number", children: [{ type: "listitem", children: [{ type: "text", text: "One", format: 0 }] }] },
          { type: "horizontalrule" },
          { type: "block", fields: { blockType: "pullQuote", text: "Quote", attribution: "Someone" } },
        ],
      },
    });
    expect(blocks.map((b) => b.type)).toEqual(["heading", "paragraph", "list", "divider", "quote"]);
    const para = blocks[1] as Extract<(typeof blocks)[number], { type: "paragraph" }>;
    expect(para.content[0]).toMatchObject({ type: "text", text: "Bold", bold: true });
    // The unsafe link is reduced to its text; the safe one survives.
    expect(para.content[1]).toMatchObject({ type: "text", text: " unsafe" });
    expect(para.content[2]).toMatchObject({ type: "link", href: "https://ok.example/", newTab: true });
  });
});
