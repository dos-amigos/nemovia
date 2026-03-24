import { Search } from "lucide-react";
import { SagraGrid } from "@/components/sagra/SagraGrid";
import { SagraCard } from "@/components/sagra/SagraCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { FadeIn } from "@/components/animations/FadeIn";
import { ResultsWithToggle } from "./ResultsWithToggle";
import type { SagraCardData } from "@/lib/queries/types";

interface SearchResultsProps {
  sagre: SagraCardData[];
}

export function SearchResults({ sagre }: SearchResultsProps) {
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
      <ResultsWithToggle sagre={sagre} />
    </FadeIn>
  );
}
