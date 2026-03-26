import { Skeleton } from "@/components/ui/skeleton";
import { SagraCardSkeleton } from "@/components/sagra/SagraCardSkeleton";

export default function CercaLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      {/* Title skeleton */}
      <Skeleton className="h-7 w-36 mb-4" />

      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Sidebar filters skeleton */}
        <aside className="w-full shrink-0 lg:w-72 space-y-3">
          <Skeleton className="h-32 w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
            <Skeleton className="h-16 rounded-lg" />
          </div>
        </aside>

        {/* Results skeleton */}
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-16 rounded-full" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SagraCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
