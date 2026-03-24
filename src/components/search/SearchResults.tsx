"use client";

import { useQueryState } from "nuqs";
import { Search } from "lucide-react";
import { SagraCard } from "@/components/sagra/SagraCard";
import { SagraListItem } from "@/components/sagra/SagraListItem";
import { SagraGrid } from "@/components/sagra/SagraGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { FadeIn } from "@/components/animations/FadeIn";
import { ViewToggle, viewParser } from "./ViewToggle";
import type { SagraCardData } from "@/lib/queries/types";

interface SearchResultsProps {
  sagre: SagraCardData[];
}

export function SearchResults({ sagre }: SearchResultsProps) {
  const [vista] = useQueryState("vista", viewParser);

  if (sagre.length === 0) {
    return (
      <EmptyState
        icon={<Search className="h-8 w-8 text-muted-foreground" />}
        title="Nessuna sagra trovata"
        description="Prova a cambiare i filtri o amplia il raggio di ricerca."
      />
    );
  }

  return (
    <FadeIn>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {sagre.length} {sagre.length === 1 ? "sagra trovata" : "sagre trovate"}
          </p>
          <ViewToggle />
        </div>

        {vista === "lista" ? (
          <div className="flex flex-col gap-2">
            {sagre.map((sagra) => (
              <SagraListItem
                key={sagra.id}
                sagra={sagra}
                distanceKm={sagra.distance_km}
              />
            ))}
          </div>
        ) : (
          <SagraGrid>
            {sagre.map((sagra) => (
              <SagraCard
                key={sagra.id}
                sagra={sagra}
                distanceKm={sagra.distance_km}
              />
            ))}
          </SagraGrid>
        )}
      </div>
    </FadeIn>
  );
}
