import Link from "next/link";
import { formatDateRange } from "@/lib/utils";
import type { MapMarkerData } from "@/lib/queries/types";

interface MapMarkerPopupProps {
  sagra: MapMarkerData;
}

export default function MapMarkerPopup({ sagra }: MapMarkerPopupProps) {
  const tags = sagra.food_tags?.slice(0, 2) ?? [];

  return (
    <div className="max-w-[200px] space-y-1">
      <p className="text-sm font-bold leading-tight">{sagra.title}</p>
      <p className="text-xs text-muted-foreground">
        {sagra.location_text}
        {sagra.province ? ` (${sagra.province})` : ""}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatDateRange(sagra.start_date, sagra.end_date)}
      </p>
      {tags.length > 0 && (
        <div className="flex gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-block rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      <Link
        href={`/sagra/${sagra.slug}`}
        className="inline-block text-xs font-medium text-primary hover:underline"
      >
        Vedi dettagli
      </Link>
    </div>
  );
}
