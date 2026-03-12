"use client";

import { useState, useCallback } from "react";
import type L from "leaflet";
import MapViewDynamic from "@/components/map/MapView.dynamic";
import LocationButton from "@/components/map/LocationButton";
import { SearchFilters } from "@/components/search/SearchFilters";
import type { MapMarkerData } from "@/lib/queries/types";

interface MappaClientPageProps {
  sagre: MapMarkerData[];
}

export default function MappaClientPage({ sagre }: MappaClientPageProps) {
  const [mapRef, setMapRef] = useState<L.Map | null>(null);

  const handleLocate = useCallback(
    (lat: number, lng: number) => {
      if (mapRef) {
        mapRef.flyTo([lat, lng], 12);
      }
    },
    [mapRef]
  );

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col lg:h-[calc(100vh-3.5rem)]">
      {/* Always-visible filter bar - constrained to header width */}
      <div className="shrink-0 border-b bg-background">
        <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
          <SearchFilters />
        </div>
      </div>
      {/* Map fills remaining space */}
      <div className="relative flex-1">
        <MapViewDynamic sagre={sagre} onMapReady={setMapRef} />
        <LocationButton onLocate={handleLocate} />
      </div>
    </div>
  );
}
