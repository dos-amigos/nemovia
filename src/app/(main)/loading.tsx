import { Skeleton } from "@/components/ui/skeleton";
import { SagraCardSkeleton } from "@/components/sagra/SagraCardSkeleton";

export default function HomeLoading() {
  return (
    <div className="space-y-8">
      {/* Hero skeleton — matches actual hero dimensions */}
      <div className="mx-4 sm:mx-6 lg:mx-8">
        <Skeleton className="h-[280px] w-full rounded-2xl sm:h-[340px] lg:h-[400px]" />
      </div>

      {/* Quick filters skeleton */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-5 w-28 mb-3" />
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-20 shrink-0 rounded-full" />
          ))}
        </div>
      </div>

      {/* Weekend section skeleton */}
      <div className="space-y-3 px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SagraCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Province section skeleton */}
      <div className="mx-auto max-w-7xl space-y-3 px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
