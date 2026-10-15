import { FeedSkeleton, StoryGridSkeleton } from "@/components/ui/LoadingSkeleton";

/** Route-level loading UI: reel placeholder on phones, card grid on larger screens. */
export default function Loading() {
  return (
    <>
      <div className="md:hidden">
        <FeedSkeleton />
      </div>
      <div className="mx-auto hidden max-w-[1680px] px-8 pt-28 md:block xl:px-12">
        <StoryGridSkeleton />
      </div>
    </>
  );
}
