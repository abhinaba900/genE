import type { StorySummary } from "./types";

/**
 * Relevance scoring for search results. The database narrows candidates (title,
 * summary, tags, category); this ranks them. For a much larger archive, swap in
 * Postgres full-text search or a search service behind `searchStories`.
 */
export function normalise(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .trim();
}

export function scoreStory(story: StorySummary, query: string): number {
  const terms = normalise(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 0;

  const title = normalise(story.title);
  const excerpt = normalise(story.excerpt);
  const category = normalise(story.category.name);
  const tags = story.tags.map(normalise);

  let score = 0;
  for (const term of terms) {
    let termScore = 0;
    if (title.includes(term)) termScore += title.split(/\s+/).some((w) => w.startsWith(term)) ? 10 : 6;
    if (category.startsWith(term)) termScore += 8;
    if (tags.some((t) => t.startsWith(term))) termScore += 7;
    else if (tags.some((t) => t.includes(term))) termScore += 4;
    if (excerpt.includes(term)) termScore += 3;
    // Every term must match somewhere for the story to be a result.
    if (termScore === 0) return 0;
    score += termScore;
  }
  return score;
}
