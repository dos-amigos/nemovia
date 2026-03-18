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
import { getFallbackImage, isLowQualityUrl } from "@/lib/fallback-images";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/animations/FadeIn";
import { ParallaxHero } from "@/components/animations/ParallaxHero";
import { ScrollReveal } from "@/components/animations/ScrollReveal";
import { formatDateRange } from "@/lib/utils";
import { parseImageCredit } from "@/lib/unsplash";
import { provinceSuffix } from "@/lib/constants/veneto";
import type { Sagra } from "@/types/database";
import BackButton from "./BackButton";
import DirectionsButton from "./DirectionsButton";
import ShareButton from "./ShareButton";
import DetailMiniMapDynamic from "./DetailMiniMap.dynamic";

interface SagraDetailProps {
  sagra: Sagra;
  videoUrl?: string | null;
}

export default function SagraDetail({ sagra, videoUrl }: SagraDetailProps) {
  const hasLocation = sagra.location !== null;
  const lat = hasLocation ? sagra.location!.coordinates[1] : null;
  const lng = hasLocation ? sagra.location!.coordinates[0] : null;

  const rawDescription = sagra.enhanced_description ?? sagra.source_description ?? sagra.description;
  // Strip markdown artifacts (##, **, *) that may leak from Gemini or Tavily snippets
  const description = rawDescription
    ?.replace(/^#+\s*/gm, "")
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, "$1")
    .trim() || null;
  const fallback = getFallbackImage(sagra.id, sagra.food_tags, sagra.title, description);
  const hasGoodImage = sagra.image_url && !isLowQualityUrl(sagra.image_url);
  const imageSrc = hasGoodImage ? sagra.image_url! : fallback;
  // Only show Unsplash credit when we're actually displaying the pipeline image (not a fallback)
  const credit = hasGoodImage ? parseImageCredit(sagra.image_credit) : null;
  const hasTags =
    (sagra.food_tags && sagra.food_tags.length > 0) ||
    (sagra.feature_tags && sagra.feature_tags.length > 0);

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <div className="space-y-6 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
        {/* LEFT column: Hero image + Mini map */}
        <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          {/* Hero image/video with parallax (mobile only) */}
          <ParallaxHero className="relative -mx-4 -mt-4 h-64 w-[calc(100%+2rem)] overflow-hidden sm:-mx-6 sm:h-72 sm:w-[calc(100%+3rem)] lg:mx-0 lg:mt-0 lg:w-full lg:h-[28rem] lg:rounded-xl">
            {/* Media: video fallback or image */}
            {!hasGoodImage && videoUrl ? (
              <video
                autoPlay
                muted
                loop
                playsInline
                className="absolute inset-0 h-full w-full object-cover"
              >
                <source src={videoUrl} type="video/mp4" />
              </video>
            ) : (
              <FadeImage
                src={imageSrc}
                fallbackSrc={fallback}
                alt={sagra.title}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
                priority
              />
            )}

            {/* Dark gradient overlay for title readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />

            {/* Title overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 lg:p-6">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white drop-shadow-lg">
                {sagra.title}
              </h1>
              {sagra.location_text && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-white/80 drop-shadow">
                  <MapPin className="size-3.5 shrink-0" />
                  <span>
                    <span className="capitalize">{sagra.location_text?.toLowerCase()}</span>
                    {provinceSuffix(sagra.province, sagra.location_text)}
                  </span>
                </p>
              )}
            </div>

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
                    foodTags={sagra.food_tags}
                  />
                </div>
              </div>
            </FadeIn>
          )}
        </div>

        {/* RIGHT column: Title, info, tags, description, actions, source */}
        <div className="space-y-6">
          {/* Date & price info */}
          <ScrollReveal direction="up">
            <div className="space-y-4">
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
