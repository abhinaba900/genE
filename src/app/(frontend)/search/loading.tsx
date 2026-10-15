import { Skeleton } from "@/components/ui/LoadingSkeleton";

export default function SearchLoading() {
  return (
    <div role="status" aria-label="Loading search" className="mx-auto max-w-[960px] px-5 pt-24 md:px-8">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-6 h-16 w-full" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="mt-8 flex gap-5">
          <Skeleton className="aspect-[9/16] w-24 rounded-xl" />
          <div className="flex-1 pt-4">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-4 h-6 w-full" />
            <Skeleton className="mt-2 h-6 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
