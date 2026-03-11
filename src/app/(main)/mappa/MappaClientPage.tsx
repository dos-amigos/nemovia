"use client";

import { useState, useCallback } from "react";
import type L from "leaflet";
import MapViewDynamic from "@/components/map/MapView.dynamic";
import LocationButton from "@/components/map/LocationButton";
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
    <div className="h-[calc(100vh-5rem)] lg:h-[calc(100vh-3.5rem)]">
      <div className="relative h-full w-full">
        <MapViewDynamic sagre={sagre} onMapReady={setMapRef} />
        <LocationButton onLocate={handleLocate} />
      </div>
    </div>
  );
}
