"use client";

import Link from "next/link";
import { Calendar, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FadeImage } from "@/components/animations/FadeImage";
import { getFallbackImage, isLowQualityUrl } from "@/lib/fallback-images";
import { formatDateRange } from "@/lib/utils";
import { provinceSuffix } from "@/lib/constants/veneto";
import { CATEGORY_COLORS, TAG_TO_CATEGORY } from "@/lib/constants/food-icons";
import type { SagraCardData } from "@/lib/queries/types";

interface SagraListItemProps {
  sagra: SagraCardData;
  distanceKm?: number;
}

export function SagraListItem({ sagra, distanceKm }: SagraListItemProps) {
  const distance = distanceKm ?? sagra.distance_km;
  const fallback = getFallbackImage(sagra.id, sagra.food_tags, sagra.title, sagra.enhanced_description);
  const hasGoodImage = sagra.image_url && !isLowQualityUrl(sagra.image_url);
  const imageSrc = hasGoodImage ? sagra.image_url! : fallback;

  const description = sagra.enhanced_description ?? "";
  const foodTags = sagra.food_tags ?? [];

  return (
    <Link
      href={`/sagra/${sagra.slug}`}
      draggable={false}
      className="group flex flex-col sm:flex-row gap-3 rounded-xl border border-border bg-card p-2 transition-shadow hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      {/* Image thumbnail */}
      <div className="relative h-40 w-full shrink-0 overflow-hidden rounded-lg sm:h-28 sm:w-30">
        <FadeImage
          src={imageSrc}
          fallbackSrc={fallback}
          alt={sagra.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 100vw, 120px"
        />
        {sagra.is_free === true && (
          <Badge className="absolute right-1.5 top-1.5 bg-accent text-accent-foreground text-[10px] px-1.5 py-0">
            Gratis
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-between gap-1 py-0.5">
        <div>
          <h3 className="font-semibold text-base line-clamp-1 group-hover:text-primary transition-colors">
            {sagra.title}
          </h3>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2 leading-snug">
              {description}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {/* Location */}
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="capitalize">{sagra.location_text?.toLowerCase()}</span>
            {provinceSuffix(sagra.province, sagra.location_text)}
          </span>

          {/* Date */}
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            {formatDateRange(sagra.start_date, sagra.end_date)}
          </span>

          {/* Distance */}
          {distance != null && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <MapPin className="h-3 w-3" />
              {distance} km
            </Badge>
          )}
        </div>

        {/* Food tags as colored pills */}
        {foodTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {foodTags.map((tag) => {
              const color = CATEGORY_COLORS[TAG_TO_CATEGORY[tag] ?? "altro"];
              return (
                <span
                  key={tag}
                  className="inline-block rounded-full px-2 py-0.5 text-[11px] font-medium text-white leading-tight"
                  style={{ backgroundColor: color }}
                >
                  {tag}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </Link>
  );
}
