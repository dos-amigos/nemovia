import { Skeleton } from "@/components/ui/skeleton";

export function SagraCardSkeleton() {
  return (
    <div className="relative h-52 w-full overflow-hidden rounded-xl">
      {/* Image placeholder */}
      <Skeleton className="absolute inset-0 rounded-xl" />

      {/* Gradient overlay mimicking card style */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 via-40% to-transparent rounded-xl" />

      {/* Text content at bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1.5">
        {/* Title */}
        <Skeleton className="h-5 w-3/4 bg-white/20" />

        {/* Location row */}
        <div className="flex items-center gap-1">
          <Skeleton className="h-3.5 w-3.5 rounded-full bg-white/15" />
          <Skeleton className="h-3.5 w-1/2 bg-white/15" />
        </div>

        {/* Date row */}
        <div className="flex items-center gap-1">
          <Skeleton className="h-3 w-3 rounded-full bg-white/15" />
          <Skeleton className="h-3 w-1/3 bg-white/15" />
        </div>
      </div>
    </div>
  );
}
