"use client";

import Link from "next/link";
import * as m from "motion/react-m";
import { Calendar, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FadeImage } from "@/components/animations/FadeImage";
import { FoodIcon } from "@/lib/constants/food-icons";
import { getFallbackImage, isLowQualityUrl } from "@/lib/fallback-images";
import { formatDateRange } from "@/lib/utils";
import { VENETO_PROVINCES } from "@/lib/constants/veneto";
import type { SagraCardData } from "@/lib/queries/types";

/** Map province value (code or full name) -> 2-letter code */
const PROVINCE_CODES: Record<string, string> = Object.fromEntries([
  ...VENETO_PROVINCES.map((p) => [p.name, p.code]),
  ...VENETO_PROVINCES.map((p) => [p.code, p.code]),
]);

interface SagraCardProps {
  sagra: SagraCardData;
  distanceKm?: number;
}

export function SagraCard({ sagra, distanceKm }: SagraCardProps) {
  const distance = distanceKm ?? sagra.distance_km;
  const fallback = getFallbackImage(sagra.id, sagra.food_tags);
  const hasGoodImage = sagra.image_url && !isLowQualityUrl(sagra.image_url);
  const imageSrc = hasGoodImage ? sagra.image_url! : fallback;

  return (
    <Link
      href={`/sagra/${sagra.slug}`}
      draggable={false}
      className="block rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <m.div
        whileHover={{ scale: 1.02, boxShadow: "0 8px 30px rgba(0,0,0,0.12)" }}
        whileTap={{ scale: 0.97 }}
        exit={{ scale: 1.05, opacity: 0, transition: { duration: 0.15 } }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="relative h-52 w-full overflow-hidden rounded-xl"
      >
        {/* Image (pipeline or themed fallback) — with onError fallback for broken URLs */}
        <FadeImage
          src={imageSrc}
          fallbackSrc={fallback}
          alt={sagra.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 75vw, (max-width: 1024px) 45vw, 280px"
        />

        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 via-40% to-transparent" />

        {/* Text content at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="font-semibold text-white text-base line-clamp-1 drop-shadow-sm">
            {sagra.title}
          </h3>
          <div className="flex items-center gap-1 text-white/80 text-sm mt-1">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">
              {sagra.location_text}
              {sagra.province && (() => {
                const loc = sagra.location_text ?? "";
                const code = PROVINCE_CODES[sagra.province] ?? "";
                // Skip if location already has code like "(RO)" or "(VR)" or full name
                if (loc.includes(`(${code})`) || loc.includes(`(${sagra.province})`)) return null;
                if (loc.toLowerCase().includes(sagra.province.toLowerCase())) return null;
                return ` (${code})`;
              })()}
            </span>
          </div>
          <div className="flex items-center gap-1 text-white/70 text-xs mt-0.5">
            <Calendar className="h-3 w-3 shrink-0" />
            <span>{formatDateRange(sagra.start_date, sagra.end_date)}</span>
          </div>
        </div>

        {/* Distance badge positioned top-left */}
        {distance != null && (
          <Badge className="absolute left-2 top-2 gap-1 bg-black/50 text-white backdrop-blur-sm">
            <MapPin className="h-3 w-3" />
            {distance} km
          </Badge>
        )}

        {/* Free badge positioned top-right */}
        {sagra.is_free === true && (
          <Badge className="absolute right-2 top-2 bg-accent text-accent-foreground">
            Gratis
          </Badge>
        )}

        {/* Food type icon positioned bottom-right */}
        <div className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-white/60 backdrop-blur-sm">
          <FoodIcon foodTags={sagra.food_tags} featureTags={sagra.feature_tags} title={sagra.title} className="h-4 w-4" themed />
        </div>
      </m.div>
    </Link>
  );
}
