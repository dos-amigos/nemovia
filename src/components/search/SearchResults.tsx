import { SagraCard } from "@/components/sagra/SagraCard";
import { SagraGrid } from "@/components/sagra/SagraGrid";
import type { SagraCardData } from "@/lib/queries/types";

interface SearchResultsProps {
  sagre: SagraCardData[];
}

export function SearchResults({ sagre }: SearchResultsProps) {
  if (sagre.length === 0) {
    return (
      <div className="py-12 text-center">
        <h2 className="text-lg font-semibold">Nessuna sagra trovata</h2>
        <p className="mt-1 text-muted-foreground">
          Prova a cambiare i filtri o amplia il raggio di ricerca.
        </p>
      </div>
    );
  }

  return (
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
  );
}
