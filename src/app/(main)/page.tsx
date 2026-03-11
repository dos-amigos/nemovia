import type { Metadata } from "next";
import {
  getWeekendSagre,
  getActiveSagre,
  getProvinceCounts,
} from "@/lib/queries/sagre";
import { HeroSection } from "@/components/home/HeroSection";
import { ScrollRowSection } from "@/components/home/ScrollRowSection";
import { QuickFilters } from "@/components/home/QuickFilters";
import { ProvinceSection } from "@/components/home/ProvinceSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { Calendar, Ticket, MapPin, ChefHat } from "lucide-react";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Scopri le sagre ed eventi gastronomici del Veneto questo weekend",
};

export default async function HomePage() {
  const [weekendSagre, allActive, provinceCounts] = await Promise.all([
    getWeekendSagre(12),
    getActiveSagre(80),
    getProvinceCounts(),
  ]);

  // Empty state: no data at all
  const hasAnyData = weekendSagre.length > 0 || allActive.length > 0;

  // --- Deduplication: build rows sequentially, tracking shown IDs ---
  const shown = new Set<string>();

  // Row 1: Weekend sagre (first priority)
  for (const s of weekendSagre) {
    shown.add(s.id);
  }

  // Row 2: Gratis sagre (excluding already shown)
  const gratisSagre = allActive
    .filter((s) => s.is_free === true && !shown.has(s.id))
    .slice(0, 12);
  for (const s of gratisSagre) {
    shown.add(s.id);
  }

  // Row 3: Top province sagre (excluding already shown)
  const topProvinceName = provinceCounts[0]?.province;
  const provinceSagre = topProvinceName
    ? allActive
        .filter((s) => s.province === topProvinceName && !shown.has(s.id))
        .slice(0, 12)
    : [];
  for (const s of provinceSagre) {
    shown.add(s.id);
  }

  // Row 4: Most common food tag with >= 3 remaining items
  const tagCounts = new Map<string, number>();
  for (const s of allActive) {
    if (shown.has(s.id)) continue;
    for (const tag of s.food_tags ?? []) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const topTag = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .find(([, count]) => count >= 3)?.[0];

  const foodSagre = topTag
    ? allActive
        .filter((s) => s.food_tags?.includes(topTag) && !shown.has(s.id))
        .slice(0, 12)
    : [];

  return (
    <div>
      <HeroSection />

      {!hasAnyData ? (
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <EmptyState
            icon={<Calendar className="h-8 w-8 text-muted-foreground" />}
            title="Nessuna sagra disponibile"
            description="Non ci sono sagre in programma al momento. Torna a controllare presto!"
          />
        </div>
      ) : (
        <div className="space-y-6 py-6">
          <ScrollRowSection
            title="Questo weekend"
            icon={<Calendar className="h-5 w-5 text-primary" />}
            sagre={weekendSagre}
            viewAllHref="/cerca"
            delay={0.1}
          />
          <ScrollRowSection
            title="Gratis"
            icon={<Ticket className="h-5 w-5 text-accent" />}
            sagre={gratisSagre}
            viewAllHref="/cerca?gratis=true"
            delay={0.15}
          />
          {topProvinceName && (
            <ScrollRowSection
              title={`A ${topProvinceName}`}
              icon={<MapPin className="h-5 w-5 text-primary" />}
              sagre={provinceSagre}
              viewAllHref={`/cerca?provincia=${topProvinceName}`}
              delay={0.2}
            />
          )}
          {topTag && (
            <ScrollRowSection
              title={`Sagre di ${topTag}`}
              icon={<ChefHat className="h-5 w-5 text-accent" />}
              sagre={foodSagre}
              viewAllHref={`/cerca?cucina=${topTag}`}
              delay={0.25}
            />
          )}
        </div>
      )}

      <div className="mx-auto max-w-7xl space-y-6 px-4 pb-6 sm:px-6 lg:px-8">
        <QuickFilters />
        <ProvinceSection counts={provinceCounts} />
      </div>
    </div>
  );
}
