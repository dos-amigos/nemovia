import Image from "next/image";
import {
  MapPin,
  Calendar,
  Tag,
  Euro,
  ExternalLink,
  ArrowLeft,
  UtensilsCrossed,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/animations/FadeIn";
import { formatDateRange } from "@/lib/utils";
import type { Sagra } from "@/types/database";
import BackButton from "./BackButton";
import DirectionsButton from "./DirectionsButton";
import ShareButton from "./ShareButton";
import DetailMiniMapDynamic from "./DetailMiniMap.dynamic";

interface SagraDetailProps {
  sagra: Sagra;
}

export default function SagraDetail({ sagra }: SagraDetailProps) {
  const hasLocation = sagra.location !== null;
  const lat = hasLocation ? sagra.location!.coordinates[1] : null;
  const lng = hasLocation ? sagra.location!.coordinates[0] : null;

  const description = sagra.enhanced_description ?? sagra.description;
  const hasTags =
    (sagra.food_tags && sagra.food_tags.length > 0) ||
    (sagra.feature_tags && sagra.feature_tags.length > 0);

  return (
    <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
      {/* LEFT column: Hero image + Mini map */}
      <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
        {/* Hero image with back button */}
        <div className="relative -mx-4 -mt-4 h-48 w-[calc(100%+2rem)] lg:mx-0 lg:mt-0 lg:w-full lg:h-64 lg:rounded-xl lg:overflow-hidden">
          {sagra.image_url ? (
            <Image
              src={sagra.image_url}
              alt={sagra.title}
              fill
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-100 to-green-100">
              <UtensilsCrossed className="h-12 w-12 text-muted-foreground/30" />
            </div>
          )}
          <BackButton />
        </div>

        {/* Mini map */}
        {hasLocation && lat !== null && lng !== null && (
          <FadeIn delay={0.2}>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Posizione</h2>
              <div className="h-48 lg:h-64 w-full overflow-hidden rounded-lg">
                <DetailMiniMapDynamic
                  lat={lat}
                  lng={lng}
                  title={sagra.title}
                />
              </div>
            </div>
          </FadeIn>
        )}
      </div>

      {/* RIGHT column: Title, info, tags, description, actions, source */}
      <div className="space-y-6">
        {/* Title & location/date info */}
        <FadeIn>
          <div className="space-y-6">
            <h1 className="text-2xl font-bold">{sagra.title}</h1>

            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" />
              <span>
                {sagra.location_text}
                {sagra.province && ` (${sagra.province})`}
              </span>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="size-4 shrink-0" />
              <span>{formatDateRange(sagra.start_date, sagra.end_date)}</span>
            </div>

            {(sagra.is_free || sagra.price_info) && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Euro className="size-4 shrink-0" />
                <span>{sagra.is_free ? "Ingresso gratuito" : sagra.price_info}</span>
              </div>
            )}
          </div>
        </FadeIn>

        {/* Tags section */}
        {hasTags && (
          <FadeIn delay={0.1}>
            <div className="flex items-start gap-2">
              <Tag className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-wrap gap-1.5">
                {sagra.food_tags?.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
                {sagra.feature_tags?.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          </FadeIn>
        )}

        {/* Description section */}
        {description && (
          <FadeIn delay={0.15}>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Descrizione</h2>
              <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                {description}
              </p>
            </div>
          </FadeIn>
        )}

        {/* Action buttons row */}
        <FadeIn delay={0.2}>
          <div className="flex gap-3">
            {hasLocation && lat !== null && lng !== null && (
              <DirectionsButton lat={lat} lng={lng} />
            )}
            <ShareButton />
          </div>
        </FadeIn>

        {/* Source link */}
        {sagra.source_url && (
          <FadeIn delay={0.2}>
            <div className="flex items-center gap-2 text-sm">
              <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
              <a
                href={sagra.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded text-muted-foreground underline underline-offset-4 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                Vedi sito originale
              </a>
            </div>
          </FadeIn>
        )}
      </div>
    </div>
  );
}
