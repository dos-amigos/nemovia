import { searchSagre } from "@/lib/queries/sagre";
import { SearchFilters } from "@/components/search/SearchFilters";
import { ActiveFilters } from "@/components/search/ActiveFilters";
import { SearchResults } from "@/components/search/SearchResults";
import type { SearchFilters as SearchFiltersType } from "@/lib/queries/types";

export default async function CercaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  // Parse search params safely
  const provincia =
    typeof params.provincia === "string" ? params.provincia : undefined;
  const cucina =
    typeof params.cucina === "string" ? params.cucina : undefined;
  const gratis = params.gratis === "true" ? true : undefined;
  const da = typeof params.da === "string" ? params.da : undefined;
  const a = typeof params.a === "string" ? params.a : undefined;

  const rawLat = typeof params.lat === "string" ? parseFloat(params.lat) : NaN;
  const rawLng = typeof params.lng === "string" ? parseFloat(params.lng) : NaN;
  const lat = !isNaN(rawLat) ? rawLat : undefined;
  const lng = !isNaN(rawLng) ? rawLng : undefined;

  const rawRaggio =
    typeof params.raggio === "string" ? parseInt(params.raggio, 10) : NaN;
  const raggio = !isNaN(rawRaggio) ? rawRaggio : undefined;

  const filters: SearchFiltersType = {
    provincia,
    cucina,
    gratis,
    da,
    a,
    ...(lat != null && lng != null ? { lat, lng, raggio: raggio ?? 30 } : {}),
  };

  const sagre = await searchSagre(filters);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Cerca sagre</h1>
      <SearchFilters />
      <ActiveFilters />
      <SearchResults sagre={sagre} />
    </div>
  );
}
