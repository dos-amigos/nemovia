import type { Metadata } from "next";
import { getWeekendSagre, getProvinceCounts } from "@/lib/queries/sagre";
import { HeroSection } from "@/components/home/HeroSection";
import { WeekendSection } from "@/components/home/WeekendSection";
import { QuickFilters } from "@/components/home/QuickFilters";
import { ProvinceSection } from "@/components/home/ProvinceSection";
import { FeaturedSagraCard } from "@/components/home/FeaturedSagraCard";
import { SagraCard } from "@/components/sagra/SagraCard";
import { FadeIn } from "@/components/animations/FadeIn";
import { Calendar } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Scopri le sagre ed eventi gastronomici del Veneto questo weekend",
};

export default async function HomePage() {
  const [weekendSagre, provinceCounts] = await Promise.all([
    getWeekendSagre(),
    getProvinceCounts(),
  ]);

  const hasSagre = weekendSagre.length > 0;
  const featured = hasSagre ? weekendSagre[0] : null;
  const regularCards = hasSagre ? weekendSagre.slice(1, 5) : [];
  const remainingSagre = hasSagre ? weekendSagre.slice(5) : [];

  return (
    <div className="space-y-6">
      <HeroSection />
      <QuickFilters />

      {/* Bento grid section */}
      <section className="space-y-3">
        <FadeIn delay={0.1}>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Calendar className="h-5 w-5 text-primary" />
            Questo weekend
          </h2>
        </FadeIn>

        {!hasSagre ? (
          <EmptyState
            icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
            title="Nessuna sagra questo weekend"
            description="Non ci sono sagre in programma per i prossimi giorni. Torna a controllare presto!"
          />
        ) : (
          <FadeIn delay={0.15}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 lg:gap-4">
              {/* Featured card spans 2 cols and 2 rows on lg */}
              {featured && (
                <div className="md:col-span-1 lg:col-span-2 lg:row-span-2">
                  <FeaturedSagraCard sagra={featured} />
                </div>
              )}
              {/* Regular cards fill remaining slots */}
              {regularCards.map((sagra) => (
                <SagraCard key={sagra.id} sagra={sagra} />
              ))}
            </div>
          </FadeIn>
        )}

        {/* Remaining sagre below the bento grid in standard grid */}
        {remainingSagre.length > 0 && (
          <WeekendSection sagre={remainingSagre} />
        )}
      </section>

      <ProvinceSection counts={provinceCounts} />
    </div>
  );
}
