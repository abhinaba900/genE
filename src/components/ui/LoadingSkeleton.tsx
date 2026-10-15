import { cn } from "@/lib/cn";

export function Skeleton({ className, dark }: { className?: string; dark?: boolean }) {
  return <div aria-hidden className={cn(dark ? "skeleton-dark" : "skeleton", "rounded-md", className)} />;
}

/** Placeholder for a grid of story cards while content loads. */
export function StoryGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading stories" className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Skeleton className="aspect-[4/5] w-full rounded-xl" />
          <Skeleton className="mt-4 h-3 w-20" />
          <Skeleton className="mt-3 h-5 w-full" />
          <Skeleton className="mt-2 h-5 w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** Full-viewport placeholder for the reel feed. */
export function FeedSkeleton() {
  return (
    <div role="status" aria-label="Loading stories" className="fixed inset-0 bg-night">
      <div className="skeleton-dark absolute inset-0" />
      <div className="absolute inset-x-5 bottom-[calc(env(safe-area-inset-bottom)+2rem)] space-y-3">
        <Skeleton dark className="h-3 w-24" />
        <Skeleton dark className="h-7 w-11/12" />
        <Skeleton dark className="h-7 w-2/3" />
        <Skeleton dark className="mt-5 h-11 w-44 rounded-full" />
      </div>
    </div>
  );
}
