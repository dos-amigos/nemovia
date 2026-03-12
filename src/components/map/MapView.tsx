"use client";

import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { VENETO_CENTER, DEFAULT_MAP_ZOOM } from "@/lib/constants/veneto";
import { getMarkerIcon } from "@/lib/map-markers";
import type { MapMarkerData } from "@/lib/queries/types";
import MapMarkerPopup from "./MapMarkerPopup";

// Fix default marker icons -- Turbopack breaks Leaflet's icon URL detection.
// Use CDN URLs as the safest approach across Webpack and Turbopack.
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface MapViewProps {
  sagre: MapMarkerData[];
  center?: [number, number];
  zoom?: number;
  onMapReady?: (map: L.Map) => void;
}

/** Calls onMapReady with the Leaflet map instance on mount. */
function MapReadyHandler({
  onMapReady,
}: {
  onMapReady?: (map: L.Map) => void;
}) {
  const map = useMap();

  useEffect(() => {
    onMapReady?.(map);
  }, [map, onMapReady]);

  return null;
}

export default function MapView({
  sagre,
  center,
  zoom,
  onMapReady,
}: MapViewProps) {
  return (
    <MapContainer
      center={center ?? VENETO_CENTER}
      zoom={zoom ?? DEFAULT_MAP_ZOOM}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MarkerClusterGroup chunkedLoading>
        {sagre.map((sagra) => {
          if (!sagra.location?.coordinates || sagra.location.coordinates.length < 2) return null;
          const position: [number, number] = [
            sagra.location.coordinates[1],
            sagra.location.coordinates[0],
          ];
          return (
            <Marker key={sagra.id} position={position} icon={getMarkerIcon(sagra.food_tags)}>
              <Tooltip>{sagra.title}</Tooltip>
              <Popup>
                <MapMarkerPopup sagra={sagra} />
              </Popup>
            </Marker>
          );
        })}
      </MarkerClusterGroup>
      <MapReadyHandler onMapReady={onMapReady} />
    </MapContainer>
  );
}
