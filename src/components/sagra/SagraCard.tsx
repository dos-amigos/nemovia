import Image from "next/image";
import Link from "next/link";
import { MapPin, Calendar, UtensilsCrossed } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateRange } from "@/lib/utils";
import type { SagraCardData } from "@/lib/queries/types";

interface SagraCardProps {
  sagra: SagraCardData;
  distanceKm?: number;
}

export function SagraCard({ sagra, distanceKm }: SagraCardProps) {
  const distance = distanceKm ?? sagra.distance_km;

  return (
    <Link href={`/sagra/${sagra.slug}`} className="block">
      <Card className="overflow-hidden py-0 hover:shadow-md transition-shadow">
        {/* Image area */}
        <div className="relative h-40 w-full">
          {sagra.image_url ? (
            <Image
              src={sagra.image_url}
              alt={sagra.title}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, 50vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-100 to-green-100">
              <UtensilsCrossed className="h-10 w-10 text-muted-foreground/50" />
            </div>
          )}

          {sagra.is_free === true && (
            <Badge className="absolute right-2 top-2 bg-accent text-accent-foreground">
              Gratis
            </Badge>
          )}
        </div>

        {/* Content */}
        <CardContent className="space-y-1.5 p-3">
          {/* Title */}
          <h3 className="font-semibold text-base line-clamp-1">
            {sagra.title}
          </h3>

          {/* Enhanced description */}
          {sagra.enhanced_description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {sagra.enhanced_description}
            </p>
          )}

          {/* Location row */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">
              {sagra.location_text}
              {sagra.province && ` (${sagra.province})`}
            </span>
            {distance != null && (
              <span className="ml-auto shrink-0 font-medium">
                {distance} km
              </span>
            )}
          </div>

          {/* Date row */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 shrink-0" />
            <span>{formatDateRange(sagra.start_date, sagra.end_date)}</span>
          </div>

          {/* Tags row */}
          {((sagra.food_tags && sagra.food_tags.length > 0) ||
            (sagra.price_info && !sagra.is_free)) && (
            <div className="flex items-center gap-1 pt-0.5">
              {sagra.food_tags?.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {sagra.price_info && !sagra.is_free && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {sagra.price_info}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
