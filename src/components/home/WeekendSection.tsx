import { Calendar } from "lucide-react";
import { SagraCard } from "@/components/sagra/SagraCard";
import { SagraGrid } from "@/components/sagra/SagraGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import type { SagraCardData } from "@/lib/queries/types";

interface WeekendSectionProps {
  sagre: SagraCardData[];
}

export function WeekendSection({ sagre }: WeekendSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Calendar className="h-5 w-5 text-primary" />
        Questo weekend
      </h2>

      {sagre.length === 0 ? (
        <EmptyState
          icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
          title="Nessuna sagra questo weekend"
          description="Non ci sono sagre in programma per i prossimi giorni. Torna a controllare presto!"
        />
      ) : (
        <SagraGrid>
          {sagre.map((sagra) => (
            <SagraCard key={sagra.id} sagra={sagra} />
          ))}
        </SagraGrid>
      )}
    </section>
  );
}
