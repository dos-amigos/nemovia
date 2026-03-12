"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { getMarkerIcon } from "@/lib/map-markers";

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

interface DetailMiniMapProps {
  lat: number;
  lng: number;
  title: string;
  /** Food tags used to pick a themed marker icon */
  foodTags?: string[] | null;
}

export default function DetailMiniMap({ lat, lng, title, foodTags }: DetailMiniMapProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={14}
      className="h-full w-full rounded-lg"
      scrollWheelZoom={true}
      dragging={true}
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[lat, lng]} icon={getMarkerIcon(foodTags)}>
        <Popup>{title}</Popup>
      </Marker>
    </MapContainer>
  );
}
