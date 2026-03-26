import Link from "next/link";
import { MapPin, Calendar, ChevronRight } from "lucide-react";
import { formatDateRange } from "@/lib/utils";
import { FoodIcons } from "@/lib/constants/food-icons";
import { getFallbackImage, isLowQualityUrl } from "@/lib/fallback-images";
import { provinceSuffix } from "@/lib/constants/veneto";
import type { MapMarkerData } from "@/lib/queries/types";

interface MapMarkerPopupProps {
  sagra: MapMarkerData;
}

export default function MapMarkerPopup({ sagra }: MapMarkerPopupProps) {
  const tags = sagra.food_tags?.slice(0, 3) ?? [];
  const hasGoodImage = sagra.image_url && !isLowQualityUrl(sagra.image_url);
  const imageSrc = hasGoodImage
    ? sagra.image_url!
    : getFallbackImage(sagra.id, sagra.food_tags, sagra.title);

  return (
    <div className="w-[240px] overflow-hidden">
      {/* Hero image */}
      <div className="relative h-[120px] w-full overflow-hidden">
        <img
          src={imageSrc}
          alt={sagra.title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        {/* Food icon badge */}
        <div className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/60 backdrop-blur-sm">
          <FoodIcons foodTags={sagra.food_tags} title={sagra.title} className="h-4 w-4" themed />
        </div>
        {/* Free badge */}
        {sagra.is_free === true && (
          <span className="absolute top-2 right-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-semibold text-white">
            Gratis
          </span>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2 p-3">
        <h3 className="text-sm font-bold leading-tight line-clamp-2">{sagra.title}</h3>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="line-clamp-1">
            <span className="capitalize">{sagra.location_text?.toLowerCase()}</span>
            {provinceSuffix(sagra.province, sagra.location_text)}
          </span>
        </div>

        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3 shrink-0" />
          <span>{formatDateRange(sagra.start_date, sagra.end_date)}</span>
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <Link
          href={`/sagra/${sagra.slug}`}
          data-cta=""
          className="mt-1 flex w-full items-center justify-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Vedi dettagli
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
