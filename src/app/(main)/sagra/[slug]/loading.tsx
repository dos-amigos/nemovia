import { Skeleton } from "@/components/ui/skeleton";

export default function SagraDetailLoading() {
  return (
    <div className="space-y-4">
      {/* Image skeleton */}
      <Skeleton className="h-48 w-full rounded-xl" />

      {/* Title skeleton */}
      <Skeleton className="h-8 w-3/4" />

      {/* Location skeleton */}
      <Skeleton className="h-5 w-1/2" />

      {/* Date skeleton */}
      <Skeleton className="h-5 w-1/3" />

      {/* Description skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      {/* Tags skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-16 rounded-full" />
        ))}
      </div>

      {/* Mini map skeleton */}
      <Skeleton className="h-48 w-full rounded-xl" />

      {/* Action buttons skeleton */}
      <div className="flex gap-3">
        <Skeleton className="h-10 w-32 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>
    </div>
  );
}
