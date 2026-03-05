import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function SagraCardSkeleton() {
  return (
    <Card className="overflow-hidden py-0">
      {/* Image area */}
      <Skeleton className="h-40 w-full rounded-none" />

      {/* Content */}
      <CardContent className="space-y-1.5 p-3">
        {/* Title */}
        <Skeleton className="h-5 w-3/4" />

        {/* Description */}
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />

        {/* Location row */}
        <div className="flex items-center gap-1">
          <Skeleton className="h-3.5 w-3.5 rounded-full" />
          <Skeleton className="h-4 w-1/2" />
        </div>

        {/* Date row */}
        <div className="flex items-center gap-1">
          <Skeleton className="h-3.5 w-3.5 rounded-full" />
          <Skeleton className="h-4 w-1/3" />
        </div>

        {/* Tags row */}
        <div className="flex items-center gap-1 pt-0.5">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-12 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      </CardContent>
    </Card>
  );
}
