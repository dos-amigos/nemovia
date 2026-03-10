import { Search } from "lucide-react";
import { SagraCard } from "@/components/sagra/SagraCard";
import { SagraGrid } from "@/components/sagra/SagraGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { FadeIn } from "@/components/animations/FadeIn";
import MapViewDynamic from "@/components/map/MapView.dynamic";
import MapFilterOverlay from "@/components/map/MapFilterOverlay";
import type { SagraCardData, MapMarkerData } from "@/lib/queries/types";

interface SearchResultsProps {
  sagre: SagraCardData[];
  vista?: "lista" | "mappa";
  mapSagre?: MapMarkerData[];
}

export function SearchResults({
  sagre,
  vista = "lista",
  mapSagre = [],
}: SearchResultsProps) {
  if (vista === "mappa") {
    return (
      <div className="relative -mx-4" style={{ height: "calc(100vh - 16rem)" }}>
        <MapViewDynamic sagre={mapSagre} />
        <MapFilterOverlay />
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] bg-background/85 backdrop-blur-[10px] border border-white/12 px-3 py-1 rounded-full text-sm">
          {mapSagre.length} risultati sulla mappa
        </p>
      </div>
    );
  }

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
        <p className="text-sm text-muted-foreground">
          {sagre.length} {sagre.length === 1 ? "sagra trovata" : "sagre trovate"}
        </p>
        <SagraGrid>
          {sagre.map((sagra) => (
            <SagraCard
              key={sagra.id}
              sagra={sagra}
              distanceKm={sagra.distance_km}
            />
          ))}
        </SagraGrid>
      </div>
    </FadeIn>
  );
}
