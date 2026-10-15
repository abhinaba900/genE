import { StoryCard } from "@/components/stories/StoryCard";
import { Reveal } from "@/components/motion/Reveal";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { StorySummary } from "@/lib/content/types";

export function RelatedStories({ stories }: { stories: StorySummary[] }) {
  if (stories.length === 0) return null;
  return (
    <section aria-labelledby="related-heading" className="mx-auto mt-24 max-w-[1680px] px-5 md:px-8 xl:px-12">
      <Reveal>
        <SectionHeading id="related-heading" kicker="Keep watching" title="Related stories" />
      </Reveal>
      <ul className="mt-8 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4 md:gap-x-6">
        {stories.map((s, i) => (
          <Reveal as="li" key={s.id} index={i}>
            <StoryCard story={s} variant="reel" />
          </Reveal>
        ))}
      </ul>
    </section>
  );
}
