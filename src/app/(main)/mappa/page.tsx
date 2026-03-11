import type { Metadata } from "next";
import { searchMapSagre } from "@/lib/queries/sagre";
import type { SearchFilters } from "@/lib/queries/types";
import MappaClientPage from "./MappaClientPage";

export const metadata: Metadata = {
  title: "Mappa sagre",
  description:
    "Scopri tutte le sagre del Veneto sulla mappa interattiva",
};

export default async function MappaPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;

  // Parse search params safely (same pattern as cerca/page.tsx)
  const provincia =
    typeof params.provincia === "string" ? params.provincia : undefined;
  const cucina =
    typeof params.cucina === "string" ? params.cucina : undefined;
  const gratis = params.gratis === "true" ? true : undefined;
  const da = typeof params.da === "string" ? params.da : undefined;
  const a = typeof params.a === "string" ? params.a : undefined;

  const rawLat =
    typeof params.lat === "string" ? parseFloat(params.lat) : NaN;
  const rawLng =
    typeof params.lng === "string" ? parseFloat(params.lng) : NaN;
  const lat = !isNaN(rawLat) ? rawLat : undefined;
  const lng = !isNaN(rawLng) ? rawLng : undefined;

  const rawRaggio =
    typeof params.raggio === "string" ? parseInt(params.raggio, 10) : NaN;
  const raggio = !isNaN(rawRaggio) ? rawRaggio : undefined;

  const filters: SearchFilters = {
    provincia,
    cucina,
    gratis,
    da,
    a,
    ...(lat != null && lng != null ? { lat, lng, raggio: raggio ?? 30 } : {}),
  };

  const sagre = await searchMapSagre(filters);

  return <MappaClientPage sagre={sagre} />;
}
