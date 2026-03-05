"use client";

import { useState, useCallback } from "react";

interface GeolocationState {
  lat: number | null;
  lng: number | null;
  error: string | null;
  loading: boolean;
}

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 300000, // 5 min cache
};

/**
 * Browser geolocation hook. Opt-in only -- call `requestLocation` to prompt.
 * Does NOT call getCurrentPosition on mount.
 */
export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    lat: null,
    lng: null,
    error: null,
    loading: false,
  });

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        error: "Geolocalizzazione non supportata dal browser",
        loading: false,
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          error: null,
          loading: false,
        });
      },
      (err) => {
        let message = "Errore di geolocalizzazione";
        if (err.code === err.PERMISSION_DENIED) {
          message = "Permesso di geolocalizzazione negato";
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          message = "Posizione non disponibile";
        } else if (err.code === err.TIMEOUT) {
          message = "Richiesta di posizione scaduta";
        }
        setState((prev) => ({
          ...prev,
          error: message,
          loading: false,
        }));
      },
      GEOLOCATION_OPTIONS
    );
  }, []);

  return {
    lat: state.lat,
    lng: state.lng,
    error: state.error,
    loading: state.loading,
    requestLocation,
  };
}
