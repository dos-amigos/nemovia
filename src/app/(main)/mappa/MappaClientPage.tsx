"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type L from "leaflet";
import MapViewDynamic from "@/components/map/MapView.dynamic";
import LocationButton from "@/components/map/LocationButton";
import { SearchFilters } from "@/components/search/SearchFilters";
import type { MapMarkerData } from "@/lib/queries/types";

interface MappaClientPageProps {
  sagre: MapMarkerData[];
  searchLat?: number;
  searchLng?: number;
}

export default function MappaClientPage({ sagre, searchLat, searchLng }: MappaClientPageProps) {
  const [mapRef, setMapRef] = useState<L.Map | null>(null);
  const lastFlyTo = useRef<string>("");

  // Fly to searched city when lat/lng change
  useEffect(() => {
    if (mapRef && searchLat != null && searchLng != null) {
      const key = `${searchLat},${searchLng}`;
      if (key !== lastFlyTo.current) {
        lastFlyTo.current = key;
        mapRef.flyTo([searchLat, searchLng], 11);
      }
    }
  }, [mapRef, searchLat, searchLng]);

  const handleLocate = useCallback(
    (lat: number, lng: number) => {
      if (mapRef) {
        mapRef.flyTo([lat, lng], 12);
      }
    },
    [mapRef]
  );

  return (
    <div className="flex h-[calc(100vh-4.5rem)] flex-col lg:h-[calc(100vh-5rem)]">
      {/* Always-visible filter bar - constrained to header width */}
      <div className="shrink-0 border-b bg-background">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <SearchFilters variant="topbar" />
        </div>
      </div>
      {/* Map fills remaining space — contained to header width with rounded corners */}
      <div className="flex-1 overflow-hidden">
        <div className="mx-auto h-full max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <div className="relative h-full overflow-hidden rounded-xl">
            <MapViewDynamic sagre={sagre} onMapReady={setMapRef} />
            <LocationButton onLocate={handleLocate} />
          </div>
        </div>
      </div>
    </div>
  );
}
