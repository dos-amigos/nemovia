"use client";

import { useEffect } from "react";
import { useGeolocation } from "@/hooks/useGeolocation";
import { Navigation, Loader2, MapPinCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LocationButtonProps {
  onLocate: (lat: number, lng: number) => void;
}

export default function LocationButton({ onLocate }: LocationButtonProps) {
  const { lat, lng, error, loading, requestLocation } = useGeolocation();

  // When geolocation succeeds, notify the parent
  useEffect(() => {
    if (lat != null && lng != null) {
      onLocate(lat, lng);
    }
  }, [lat, lng, onLocate]);

  const hasLocation = lat != null && lng != null;

  return (
    <div className="absolute top-3 right-3 z-[1000]">
      {hasLocation ? (
        <Button
          variant="outline"
          size="sm"
          className="bg-accent/10 border-accent/30 text-accent shadow-md"
          onClick={requestLocation}
        >
          <MapPinCheck className="h-4 w-4" />
          Posizione attiva
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="glass-overlay shadow-md"
          onClick={requestLocation}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          {loading ? "Localizzazione..." : "Vicino a me"}
        </Button>
      )}
      {error && (
        <p className="mt-1 rounded bg-destructive/10 px-2 py-1 text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
