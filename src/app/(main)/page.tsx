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
import { Calendar, MapPin, Ticket } from "lucide-react";
import { FoodIcon } from "@/lib/constants/food-icons";
import type { SagraCardData } from "@/lib/queries/types";
import { fetchCityVideos } from "@/lib/hero-videos";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Scopri le sagre ed eventi gastronomici del Veneto questo weekend",
};

/** Tags too generic to be a standalone row */
const SKIP_TAGS = new Set([
  "Prodotti Tipici",
  "Cucina Tradizionale",
  "Gastronomia",
  "Specialità Locali",
  "Prodotti Locali",
]);

const MIN_ROW = 3;
const MAX_PROVINCE_ROWS = 3;
const MAX_FOOD_ROWS = 4;

export default async function HomePage() {
  const [weekendSagre, allActive, provinceCounts, cityVideos] =
    await Promise.all([
      getWeekendSagre(20),
      getActiveSagre(120),
      getProvinceCounts(),
      fetchCityVideos(2), // Fetch 2 Veneto city center videos
    ]);

  const hasAnyData = weekendSagre.length > 0 || allActive.length > 0;

  // --- Row building ---
  // Netflix approach: same sagra CAN appear in different category types
  // (e.g. in "A Verona" AND "Sagre di Vino") but NOT twice within same type.

  // Row 1: Gratis
  const gratisSagre = allActive.filter((s) => s.is_free === true).slice(0, 12);

  // Province rows: up to 3, dedup within province rows only
  const provinceShown = new Set<string>();
  const provinceRows: { name: string; sagre: SagraCardData[] }[] = [];
  for (const pc of provinceCounts) {
    if (provinceRows.length >= MAX_PROVINCE_ROWS) break;
    const sagre = allActive
      .filter((s) => s.province === pc.province && !provinceShown.has(s.id))
      .slice(0, 12);
    if (sagre.length >= MIN_ROW) {
      for (const s of sagre) provinceShown.add(s.id);
      provinceRows.push({ name: pc.province, sagre });
    }
  }

  // Food tag rows: up to 4, dedup within food rows only
  const tagCounts = new Map<string, number>();
  for (const s of allActive) {
    for (const tag of s.food_tags ?? []) {
      if (SKIP_TAGS.has(tag)) continue;
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const sortedTags = [...tagCounts.entries()]
    .filter(([, count]) => count >= MIN_ROW)
    .sort((a, b) => b[1] - a[1]);

  const foodShown = new Set<string>();
  const foodRows: { tag: string; sagre: SagraCardData[] }[] = [];
  for (const [tag] of sortedTags) {
    if (foodRows.length >= MAX_FOOD_ROWS) break;
    const sagre = allActive
      .filter(
        (s) => (s.food_tags ?? []).includes(tag) && !foodShown.has(s.id),
      )
      .slice(0, 12);
    if (sagre.length >= MIN_ROW) {
      for (const s of sagre) foodShown.add(s.id);
      foodRows.push({ tag, sagre });
    }
  }

  let delay = 0.1;

  return (
    <div>
      <HeroSection cityVideos={cityVideos} />

      {/* Quick filters right after hero */}
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <QuickFilters />
      </div>

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
            delay={(delay += 0.05)}
            minItems={1}
          />
          <ScrollRowSection
            title="Gratis"
            icon={<Ticket className="h-5 w-5 text-accent" />}
            sagre={gratisSagre}
            viewAllHref="/cerca?gratis=true"
            delay={(delay += 0.05)}
          />

          {/* Province rows */}
          {provinceRows.map((row) => (
            <ScrollRowSection
              key={row.name}
              title={`A ${row.name}`}
              icon={<MapPin className="h-5 w-5 text-primary" />}
              sagre={row.sagre}
              viewAllHref={`/cerca?provincia=${row.name}`}
              delay={(delay += 0.05)}
            />
          ))}

          {/* Food type rows */}
          {foodRows.map((row) => (
            <ScrollRowSection
              key={row.tag}
              title={`Sagre di ${row.tag}`}
              icon={<FoodIcon foodTags={[row.tag]} className="h-5 w-5" themed />}
              sagre={row.sagre}
              viewAllHref={`/cerca?cucina=${row.tag}`}
              delay={(delay += 0.05)}
            />
          ))}
        </div>
      )}

      <div className="mx-auto max-w-7xl space-y-6 px-4 pb-6 sm:px-6 lg:px-8">
        <ProvinceSection counts={provinceCounts} />
      </div>
    </div>
  );
}
