import { SagraCard } from "@/components/sagra/SagraCard";
import { SagraGrid } from "@/components/sagra/SagraGrid";
import { FadeIn } from "@/components/animations/FadeIn";
import type { SagraCardData } from "@/lib/queries/types";

interface WeekendSectionProps {
  sagre: SagraCardData[];
}

export function WeekendSection({ sagre }: WeekendSectionProps) {
  if (sagre.length === 0) return null;
  return (
    <FadeIn delay={0.2}>
      <SagraGrid>
        {sagre.map((sagra) => (
          <SagraCard key={sagra.id} sagra={sagra} />
        ))}
      </SagraGrid>
    </FadeIn>
  );
}
