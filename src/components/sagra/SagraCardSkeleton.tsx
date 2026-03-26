import { Skeleton } from "@/components/ui/skeleton";

export function SagraCardSkeleton() {
  return (
    <div className="relative h-52 w-full overflow-hidden rounded-xl bg-muted">
      {/* Full shimmer background */}
      <Skeleton className="absolute inset-0 rounded-xl" />

      {/* Light text placeholders at bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-3 space-y-1.5">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}
