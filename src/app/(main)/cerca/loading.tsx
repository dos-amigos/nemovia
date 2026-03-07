import { Skeleton } from "@/components/ui/skeleton";
import { SagraCardSkeleton } from "@/components/sagra/SagraCardSkeleton";

export default function CercaLoading() {
  return (
    <div className="space-y-4">
      {/* Title skeleton */}
      <Skeleton className="h-7 w-36" />

      {/* Filters skeleton */}
      <Skeleton className="h-10 w-full rounded-lg" />

      {/* Active filters skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-16 rounded-full" />
        ))}
      </div>

      {/* View toggle skeleton */}
      <Skeleton className="h-9 w-24 rounded-md" />

      {/* Results skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <SagraCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
