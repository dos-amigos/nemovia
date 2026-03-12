import { FadeImage } from "@/components/animations/FadeImage";
import {
  MapPin,
  Calendar,
  Tag,
  Euro,
  ExternalLink,
  UtensilsCrossed,
  Clock,
} from "lucide-react";
import { getFallbackImage } from "@/lib/fallback-images";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/animations/FadeIn";
import { ScrollProgress } from "@/components/animations/ScrollProgress";
import { ParallaxHero } from "@/components/animations/ParallaxHero";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { formatDateRange } from "@/lib/utils";
import { parseImageCredit } from "@/lib/unsplash";
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

  const description = sagra.source_description ?? sagra.enhanced_description ?? sagra.description;
  const credit = parseImageCredit(sagra.image_credit);
  const hasTags =
    (sagra.food_tags && sagra.food_tags.length > 0) ||
    (sagra.feature_tags && sagra.feature_tags.length > 0);

  return (
    <>
      <ScrollProgress />
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
        {/* LEFT column: Hero image + Mini map */}
        <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          {/* Hero image with parallax (mobile only) */}
          <ParallaxHero className="relative -mx-4 -mt-4 h-64 w-[calc(100%+2rem)] overflow-hidden sm:-mx-6 sm:h-72 sm:w-[calc(100%+3rem)] lg:mx-0 lg:mt-0 lg:w-full lg:h-[28rem] lg:rounded-xl">
            <FadeImage
              src={sagra.image_url || getFallbackImage(sagra.id, sagra.food_tags)}
              alt={sagra.title}
              fill
              className="object-cover"
              priority
            />
            <BackButton />
          </ParallaxHero>

          {/* Unsplash photographer attribution */}
          {credit && (
            <div className="text-[11px] text-muted-foreground/60 -mt-4 px-1">
              Photo by{" "}
              <a
                href={credit.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-muted-foreground"
              >
                {credit.name}
              </a>{" "}
              on{" "}
              <a
                href="https://unsplash.com/?utm_source=nemovia&utm_medium=referral"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-muted-foreground"
              >
                Unsplash
              </a>
            </div>
          )}

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
          <ScrollReveal direction="up">
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
          </ScrollReveal>

          {/* Tags section */}
          {hasTags && (
            <ScrollReveal direction="left" delay={0.1}>
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
            </ScrollReveal>
          )}

          {/* Menu section */}
          {sagra.menu_text && (
            <ScrollReveal direction="up" delay={0.12}>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <UtensilsCrossed className="size-4 text-primary" />
                  Menu
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                  {sagra.menu_text}
                </p>
              </div>
            </ScrollReveal>
          )}

          {/* Orari section */}
          {sagra.orari_text && (
            <ScrollReveal direction="up" delay={0.14}>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="size-4 text-primary" />
                  Orari
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                  {sagra.orari_text}
                </p>
              </div>
            </ScrollReveal>
          )}

          {/* Description section */}
          {description && (
            <ScrollReveal direction="right" delay={0.16}>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold">Descrizione</h2>
                <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                  {description}
                </p>
              </div>
            </ScrollReveal>
          )}

          {/* Action buttons row */}
          <ScrollReveal direction="up" delay={0.2}>
            <div className="flex gap-3">
              {hasLocation && lat !== null && lng !== null && (
                <DirectionsButton lat={lat} lng={lng} />
              )}
              <ShareButton />
            </div>
          </ScrollReveal>

          {/* Source link */}
          {sagra.source_url && (
            <ScrollReveal direction="left" delay={0.2}>
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
            </ScrollReveal>
          )}
        </div>
      </div>
      </div>
    </>
  );
}
