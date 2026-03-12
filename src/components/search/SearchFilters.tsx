"use client";

import {
  useQueryStates,
  parseAsString,
  parseAsInteger,
  parseAsBoolean,
} from "nuqs";
import { useGeolocation } from "@/hooks/useGeolocation";
import { VENETO_PROVINCES } from "@/lib/constants/veneto";
import { FOOD_TAGS } from "@/lib/enrichment/llm";
import {
  filterComuni,
  type VenetoComune,
} from "@/lib/constants/veneto-comuni";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Navigation,
  Loader2,
  X,
  MapPin,
  MapPinCheck,
  Search,
} from "lucide-react";
import { useEffect, useCallback, useState, useRef, useMemo } from "react";

const filterParsers = {
  provincia: parseAsString,
  raggio: parseAsInteger.withDefault(30),
  cucina: parseAsString,
  gratis: parseAsBoolean,
  da: parseAsString,
  a: parseAsString,
  lat: parseAsString, // stored as string in URL, parsed to number by server
  lng: parseAsString,
  cityName: parseAsString,
};

export function SearchFilters() {
  const [filters, setFilters] = useQueryStates(filterParsers, {
    shallow: false,
  });

  const {
    lat: geoLat,
    lng: geoLng,
    error,
    loading,
    requestLocation,
  } = useGeolocation();

  const hasGeo = filters.lat != null && filters.lng != null;

  // ---- City autocomplete state ----
  const [cityQuery, setCityQuery] = useState("");
  const [cityOpen, setCityOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const cityInputRef = useRef<HTMLInputElement>(null);
  const cityListRef = useRef<HTMLUListElement>(null);

  const filteredCities = useMemo(() => filterComuni(cityQuery), [cityQuery]);

  // Open/close dropdown when results change
  useEffect(() => {
    setCityOpen(filteredCities.length > 0);
    setHighlightIndex(-1);
  }, [filteredCities]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (
        !cityInputRef.current?.parentElement?.contains(target) &&
        !cityListRef.current?.contains(target)
      ) {
        setCityOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightIndex >= 0 && cityListRef.current) {
      const items = cityListRef.current.querySelectorAll("li");
      items[highlightIndex]?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIndex]);

  function selectCity(city: VenetoComune) {
    setCityOpen(false);
    setCityQuery("");
    setFilters({
      lat: city.lat.toFixed(6),
      lng: city.lng.toFixed(6),
      cityName: `${city.nome} (${city.provincia})`,
    });
  }

  function handleCityKeyDown(e: React.KeyboardEvent) {
    if (!cityOpen || filteredCities.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev < filteredCities.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((prev) =>
        prev > 0 ? prev - 1 : filteredCities.length - 1
      );
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      selectCity(filteredCities[highlightIndex]);
    } else if (e.key === "Escape") {
      setCityOpen(false);
    }
  }

  function clearGeo() {
    setFilters({ lat: null, lng: null, raggio: null, cityName: null });
  }

  // Sync browser geolocation result to URL params
  useEffect(() => {
    if (geoLat != null && geoLng != null) {
      setFilters({
        lat: geoLat.toFixed(6),
        lng: geoLng.toFixed(6),
        cityName: "La mia posizione",
      });
    }
  }, [geoLat, geoLng, setFilters]);

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
      cityName: null,
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
    <div className="space-y-4">
      {/* ---- City search + Geolocation row ---- */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          {/* City autocomplete input */}
          <div className="relative flex-1">
            {hasGeo ? (
              /* Active location chip */
              <div className="flex h-9 items-center gap-2 rounded-md border border-accent/30 bg-accent/10 px-3">
                <MapPinCheck className="h-4 w-4 shrink-0 text-accent" />
                <span className="flex-1 truncate text-sm font-medium text-accent">
                  {filters.cityName ?? "Posizione attiva"}
                </span>
                <button
                  type="button"
                  onClick={clearGeo}
                  className="ml-1 rounded-full p-0.5 text-accent/60 transition-colors hover:bg-accent/20 hover:text-accent"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              /* City search input */
              <>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={cityInputRef}
                    type="text"
                    value={cityQuery}
                    onChange={(e) => setCityQuery(e.target.value)}
                    onKeyDown={handleCityKeyDown}
                    onFocus={() =>
                      filteredCities.length > 0 && setCityOpen(true)
                    }
                    placeholder="Cerca citta..."
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={cityOpen}
                    aria-haspopup="listbox"
                    aria-autocomplete="list"
                    className="h-9 w-full rounded-md border border-input bg-transparent pl-9 pr-3 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  />
                </div>

                {/* Autocomplete dropdown */}
                {cityOpen && filteredCities.length > 0 && (
                  <ul
                    ref={cityListRef}
                    role="listbox"
                    className="absolute left-0 right-0 z-50 mt-1 max-h-[200px] overflow-y-auto rounded-md border border-border bg-popover shadow-md"
                  >
                    {filteredCities.map((city, i) => (
                      <li
                        key={`${city.nome}-${city.provincia}`}
                        role="option"
                        aria-selected={i === highlightIndex}
                        className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm transition-colors ${
                          i === highlightIndex
                            ? "bg-accent/15 text-foreground"
                            : "text-foreground hover:bg-muted"
                        }`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectCity(city);
                        }}
                        onMouseEnter={() => setHighlightIndex(i)}
                      >
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span>
                          {city.nome}{" "}
                          <span className="text-muted-foreground">
                            ({city.provincia})
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          {/* Geolocation button (secondary, smaller) */}
          {!hasGeo && (
            <Button
              variant="outline"
              size="sm"
              onClick={requestLocation}
              disabled={loading}
              className="shrink-0 whitespace-nowrap"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4" />
              )}
              {loading ? "Localizzazione..." : "Posizione"}
            </Button>
          )}
        </div>

        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}

        {/* ---- Radius slider (visible when geo is active) ---- */}
        {hasGeo && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Raggio di ricerca
              </label>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary tabular-nums">
                {filters.raggio} km
              </span>
            </div>
            <Slider
              min={5}
              max={100}
              step={5}
              value={[filters.raggio]}
              onValueChange={([val]) => {
                if (val !== undefined) {
                  setFilters({ raggio: val });
                }
              }}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>5 km</span>
              <span>50 km</span>
              <span>100 km</span>
            </div>
          </div>
        )}
      </div>

      {/* ---- Filter grid ---- */}
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
            onChange={(e) => setFilters({ da: e.target.value || null })}
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
            onChange={(e) => setFilters({ a: e.target.value || null })}
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
