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
import type { SagraCardData } from "@/lib/queries/types";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Scopri le sagre ed eventi gastronomici del Veneto questo weekend",
};

/** Tags too generic to be a standalone row — skip these */
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
  const [weekendSagre, allActive, provinceCounts] = await Promise.all([
    getWeekendSagre(12),
    getActiveSagre(120),
    getProvinceCounts(),
  ]);

  const hasAnyData = weekendSagre.length > 0 || allActive.length > 0;

  // --- Deduplication: build rows sequentially, tracking shown IDs ---
  const shown = new Set<string>();

  function takeUnshown(
    source: SagraCardData[],
    predicate: (s: SagraCardData) => boolean,
    limit = 12,
  ): SagraCardData[] {
    const result: SagraCardData[] = [];
    for (const s of source) {
      if (shown.has(s.id) || !predicate(s)) continue;
      result.push(s);
      if (result.length >= limit) break;
    }
    for (const s of result) shown.add(s.id);
    return result;
  }

  // Row 1: Weekend
  for (const s of weekendSagre) shown.add(s.id);

  // Row 2: Gratis
  const gratisSagre = takeUnshown(allActive, (s) => s.is_free === true);

  // Province rows: top 2-3 provinces with enough sagre
  const provinceRows: { name: string; sagre: SagraCardData[] }[] = [];
  for (const pc of provinceCounts) {
    if (provinceRows.length >= MAX_PROVINCE_ROWS) break;
    const sagre = takeUnshown(allActive, (s) => s.province === pc.province);
    if (sagre.length >= MIN_ROW) {
      provinceRows.push({ name: pc.province, sagre });
    }
  }

  // Food tag rows: multiple specific tags (skip generic ones)
  const tagCandidates = new Map<string, number>();
  for (const s of allActive) {
    if (shown.has(s.id)) continue;
    for (const tag of s.food_tags ?? []) {
      if (SKIP_TAGS.has(tag)) continue;
      tagCandidates.set(tag, (tagCandidates.get(tag) ?? 0) + 1);
    }
  }
  const sortedTags = [...tagCandidates.entries()]
    .filter(([, count]) => count >= MIN_ROW)
    .sort((a, b) => b[1] - a[1]);

  const foodRows: { tag: string; sagre: SagraCardData[] }[] = [];
  for (const [tag] of sortedTags) {
    if (foodRows.length >= MAX_FOOD_ROWS) break;
    const sagre = takeUnshown(allActive, (s) =>
      (s.food_tags ?? []).includes(tag),
    );
    if (sagre.length >= MIN_ROW) {
      foodRows.push({ tag, sagre });
    }
  }

  let delay = 0.1;

  return (
    <div>
      <HeroSection />

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
              icon={<ChefHat className="h-5 w-5 text-accent" />}
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
