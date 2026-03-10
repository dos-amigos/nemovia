"use client";

import { useQueryStates, parseAsString, parseAsInteger, parseAsBoolean } from "nuqs";
import { useGeolocation } from "@/hooks/useGeolocation";
import { VENETO_PROVINCES } from "@/lib/constants/veneto";
import { FOOD_TAGS } from "@/lib/enrichment/llm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Navigation, Loader2, X, MapPinCheck } from "lucide-react";
import { useEffect, useCallback } from "react";

const filterParsers = {
  provincia: parseAsString,
  raggio: parseAsInteger.withDefault(30),
  cucina: parseAsString,
  gratis: parseAsBoolean,
  da: parseAsString,
  a: parseAsString,
  lat: parseAsString, // stored as string in URL, parsed to number by server
  lng: parseAsString,
};

export function SearchFilters() {
  const [filters, setFilters] = useQueryStates(filterParsers, {
    shallow: false,
  });

  const { lat, lng, error, loading, requestLocation } = useGeolocation();

  const hasGeo = filters.lat != null && filters.lng != null;

  // Sync geolocation result to URL params
  useEffect(() => {
    if (lat != null && lng != null) {
      setFilters({
        lat: lat.toFixed(6),
        lng: lng.toFixed(6),
      });
    }
  }, [lat, lng, setFilters]);

  const clearAll = useCallback(() => {
    setFilters({
      provincia: null,
      raggio: null,
      cucina: null,
      gratis: null,
      da: null,
      a: null,
      lat: null,
      lng: null,
    });
  }, [setFilters]);

  const hasAnyFilter =
    filters.provincia != null ||
    filters.cucina != null ||
    filters.gratis != null ||
    filters.da != null ||
    filters.a != null ||
    hasGeo;

  return (
    <div className="space-y-3">
      {/* Geolocation button */}
      <div>
        {hasGeo ? (
          <Button
            variant="outline"
            size="sm"
            className="text-accent border-accent/30 bg-accent/10"
            onClick={() => setFilters({ lat: null, lng: null, raggio: null })}
          >
            <MapPinCheck className="h-4 w-4" />
            Posizione attiva
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={requestLocation}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            {loading ? "Localizzazione..." : "Usa la mia posizione"}
          </Button>
        )}
        {error && (
          <p className="mt-1 text-xs text-destructive">{error}</p>
        )}
      </div>

      {/* Filter grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {/* Provincia */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Provincia
          </label>
          <Select
            value={filters.provincia ?? "__all__"}
            onValueChange={(v) =>
              setFilters({ provincia: v === "__all__" ? null : v })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Tutte le province" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutte</SelectItem>
              {VENETO_PROVINCES.map((p) => (
                <SelectItem key={p.code} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Raggio km -- only visible when geolocation is active */}
        {hasGeo && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Raggio km
            </label>
            <Input
              type="number"
              min={5}
              max={100}
              step={5}
              value={filters.raggio}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 5 && val <= 100) {
                  setFilters({ raggio: val });
                }
              }}
            />
          </div>
        )}

        {/* Tipo cucina */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Tipo cucina
          </label>
          <Select
            value={filters.cucina ?? ""}
            onValueChange={(v) =>
              setFilters({ cucina: v === "__all__" ? null : v })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Tutti i tipi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tutti</SelectItem>
              {FOOD_TAGS.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Gratis toggle */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Ingresso
          </label>
          <div className="flex gap-1">
            <Button
              variant={filters.gratis ? "outline" : "default"}
              size="sm"
              className="flex-1"
              onClick={() => setFilters({ gratis: null })}
            >
              Tutti
            </Button>
            <Button
              variant={filters.gratis ? "default" : "outline"}
              size="sm"
              className="flex-1"
              onClick={() => setFilters({ gratis: true })}
            >
              Gratis
            </Button>
          </div>
        </div>

        {/* Date range: Da */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            Da
          </label>
          <Input
            type="date"
            value={filters.da ?? ""}
            onChange={(e) =>
              setFilters({ da: e.target.value || null })
            }
          />
        </div>

        {/* Date range: A */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">
            A
          </label>
          <Input
            type="date"
            value={filters.a ?? ""}
            onChange={(e) =>
              setFilters({ a: e.target.value || null })
            }
          />
        </div>
      </div>

      {/* Reset button */}
      {hasAnyFilter && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="h-4 w-4" />
          Cancella filtri
        </Button>
      )}
    </div>
  );
}
