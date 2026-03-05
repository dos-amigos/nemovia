import { Skeleton } from "@/components/ui/skeleton";
import { SagraCardSkeleton } from "@/components/sagra/SagraCardSkeleton";

export default function HomeLoading() {
  return (
    <div className="space-y-8">
      {/* Hero skeleton */}
      <Skeleton className="h-40 w-full rounded-2xl" />

      {/* Quick filters skeleton */}
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 shrink-0 rounded-full" />
        ))}
      </div>

      {/* Weekend section skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SagraCardSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Province section skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
