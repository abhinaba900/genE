import type { Story } from "@/lib/content/types";
import { SITE_NAME, absoluteUrl, storyPath } from "@/lib/site";

/** Renders schema.org structured data. Escapes `<` to prevent script injection. */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

const publisher = {
  "@type": "Organization",
  name: SITE_NAME,
  url: absoluteUrl("/"),
  logo: { "@type": "ImageObject", url: absoluteUrl("/brand/gen-e-logo.png"), width: 960, height: 298 },
};

export function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: absoluteUrl("/"),
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${absoluteUrl("/search")}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

function isoDuration(seconds: number) {
  const s = Math.round(seconds);
  return `PT${Math.floor(s / 60)}M${s % 60}S`;
}

export function articleJsonLd(story: Story) {
  const url = absoluteUrl(storyPath(story.slug));
  return [
    {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      headline: story.title,
      description: story.excerpt,
      image: [absoluteUrl(story.thumbnail.src)],
      datePublished: story.publishedAt,
      dateModified: story.updatedAt ?? story.publishedAt,
      articleSection: story.category.name,
      keywords: story.tags.join(", "),
      author: [{ "@type": "Person", name: story.author.name, jobTitle: story.author.role }],
      publisher,
      video: {
        "@type": "VideoObject",
        name: story.title,
        description: story.excerpt,
        thumbnailUrl: [absoluteUrl(story.video.poster)],
        uploadDate: story.publishedAt,
        duration: isoDuration(story.video.duration),
        contentUrl: absoluteUrl(story.video.src),
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
        { "@type": "ListItem", position: 2, name: story.category.name, item: absoluteUrl(`/category/${story.category.slug}`) },
        { "@type": "ListItem", position: 3, name: story.title, item: url },
      ],
    },
  ];
}
