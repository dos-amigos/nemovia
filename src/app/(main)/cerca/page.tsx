import type { Metadata } from "next";
import { searchSagre } from "@/lib/queries/sagre";
import { SearchFilters } from "@/components/search/SearchFilters";
import { ActiveFilters } from "@/components/search/ActiveFilters";
import { SearchResults } from "@/components/search/SearchResults";
import type { SearchFilters as SearchFiltersType } from "@/lib/queries/types";

export const metadata: Metadata = {
  title: "Cerca sagre",
  description:
    "Cerca e filtra sagre per provincia, tipo cucina, data e distanza",
};

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
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
      <h1 className="text-xl font-bold mb-4">Cerca sagre</h1>
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Sidebar filters (left on desktop, top on mobile) */}
        <aside className="w-full shrink-0 lg:w-72">
          <div className="lg:sticky lg:top-20">
            <SearchFilters />
          </div>
        </aside>
        {/* Results */}
        <div className="min-w-0 flex-1 space-y-4">
          <ActiveFilters />
          <SearchResults sagre={sagre} />
        </div>
      </div>
    </div>
  );
}
