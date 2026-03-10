"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { MapPin, Calendar, UtensilsCrossed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { FadeImage } from "@/components/animations/FadeImage";
import { formatDateRange } from "@/lib/utils";
import type { SagraCardData } from "@/lib/queries/types";

interface FeaturedSagraCardProps {
  sagra: SagraCardData;
}

export function FeaturedSagraCard({ sagra }: FeaturedSagraCardProps) {
  return (
    <Link
      href={`/sagra/${sagra.slug}`}
      className="block h-full rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <motion.div
        whileHover={{
          scale: 1.01,
          boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
        }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="relative h-full min-h-[320px] w-full overflow-hidden rounded-xl"
      >
        {sagra.image_url ? (
          <FadeImage
            src={sagra.image_url}
            alt={sagra.title}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 50vw"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 via-accent/8 to-primary/15">
            <UtensilsCrossed className="h-14 w-14 text-muted-foreground/25" />
          </div>
        )}

        {/* Stronger gradient for larger card */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />

        {/* Featured label */}
        <Badge className="absolute left-3 top-3 bg-primary text-primary-foreground">
          In evidenza
        </Badge>

        {sagra.is_free === true && (
          <Badge className="absolute right-3 top-3 bg-accent text-accent-foreground">
            Gratis
          </Badge>
        )}

        {/* Text content - larger for featured card */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-bold text-white text-xl line-clamp-2 drop-shadow-sm lg:text-2xl">
            {sagra.title}
          </h3>
          {sagra.enhanced_description && (
            <p className="text-white/75 text-sm mt-1.5 line-clamp-2">
              {sagra.enhanced_description}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1 text-white/80 text-sm">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="line-clamp-1">{sagra.location_text}</span>
            </div>
            <div className="flex items-center gap-1 text-white/70 text-sm">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                {formatDateRange(sagra.start_date, sagra.end_date)}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
