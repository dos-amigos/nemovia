import { Skeleton } from "@/components/ui/skeleton";

export default function SagraDetailLoading() {
  return (
    <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
      {/* Left column: Image + Mini map skeletons */}
      <div className="space-y-4">
        {/* Image skeleton */}
        <Skeleton className="h-48 lg:h-64 w-full rounded-xl" />

        {/* Mini map skeleton */}
        <div className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-48 lg:h-64 w-full rounded-xl" />
        </div>
      </div>

      {/* Right column: Title, location, date, description, tags, actions */}
      <div className="space-y-4">
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

        {/* Action buttons skeleton */}
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
