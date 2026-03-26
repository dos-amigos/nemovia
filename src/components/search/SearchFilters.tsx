"use client";

import { useQueryStates } from "nuqs";
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
import { filterParsers } from "./filter-parsers";

interface SearchFiltersProps {
  /** "sidebar" = vertical stacking for /cerca, "topbar" = horizontal for /mappa */
  variant?: "sidebar" | "topbar";
}

export function SearchFilters({ variant = "sidebar" }: SearchFiltersProps) {
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

  // Local radius state for smooth dragging (only commits to URL on release)
  const [localRaggio, setLocalRaggio] = useState(filters.raggio);
  useEffect(() => {
    setLocalRaggio(filters.raggio);
  }, [filters.raggio]);

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

  // ---- City search block (reused in both variants) ----
  const citySearchBlock = (
    <div className={`flex ${variant === "topbar" ? "flex-row items-center" : "flex-col"} gap-2`}>
      <div className="relative flex-1">
        {hasGeo ? (
          <div className="flex h-10 items-center gap-2 rounded-lg border border-accent/30 bg-accent/10 px-3">
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
                placeholder="Cerca per città..."
                autoComplete="off"
                role="combobox"
                aria-label="Cerca per città"
                aria-expanded={cityOpen}
                aria-haspopup="listbox"
                aria-autocomplete="list"
                aria-controls="filter-city-listbox"
                className="h-10 w-full rounded-lg border border-input bg-transparent pl-9 pr-3 text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </div>

            {cityOpen && filteredCities.length > 0 && (
              <ul
                ref={cityListRef}
                id="filter-city-listbox"
                role="listbox"
                className="absolute left-0 right-0 z-50 mt-1 max-h-[240px] overflow-y-auto rounded-lg border border-border bg-popover shadow-lg"
              >
                {filteredCities.map((city, i) => (
                  <li
                    key={`${city.nome}-${city.provincia}`}
                    role="option"
                    aria-selected={i === highlightIndex}
                    className={`flex cursor-pointer items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
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
                    <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
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

      {!hasGeo && (
        <Button
          variant="outline"
          size="sm"
          onClick={requestLocation}
          disabled={loading}
          className={`h-10 whitespace-nowrap rounded-lg ${variant === "topbar" ? "shrink-0 px-4" : "w-full"}`}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4" />
          )}
          {loading ? "Localizzazione..." : "Usa posizione"}
        </Button>
      )}
    </div>
  );

  // ---- Radius slider block ----
  const radiusBlock = hasGeo ? (
    <div className="space-y-3 pt-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-foreground">
          Raggio
        </label>
        <span className="min-w-[4rem] rounded-full bg-primary/10 px-3 py-1 text-center text-sm font-semibold text-primary tabular-nums">
          {localRaggio} km
        </span>
      </div>
      <Slider
        min={5}
        max={100}
        step={5}
        value={[localRaggio]}
        onValueChange={([val]) => {
          if (val !== undefined) {
            setLocalRaggio(val);
          }
        }}
        onValueCommit={([val]) => {
          if (val !== undefined) {
            setFilters({ raggio: val });
          }
        }}
        className="w-full"
      />
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>5 km</span>
        <span>50 km</span>
        <span>100 km</span>
      </div>
    </div>
  ) : null;

  // ---- Filter fields (reused) ----
  const provinciaField = (
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
            <SelectItem key={p.code} value={p.code}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const cucinaField = (
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
  );

  const gratisField = (
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
  );

  const daField = (
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
  );

  const aField = (
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
  );

  const resetButton = hasAnyFilter ? (
    <Button variant="ghost" size="sm" onClick={clearAll}>
      <X className="h-4 w-4" />
      Cancella filtri
    </Button>
  ) : null;

  // =============================================
  // TOPBAR VARIANT (map page — horizontal layout, 2 rows)
  // =============================================
  if (variant === "topbar") {
    return (
      <div className="relative z-20 space-y-2">
        {/* Row 1: City search + Usa posizione on same line */}
        <div className="relative z-30">
          {citySearchBlock}
        </div>

        {/* Row 2: Other filters — full width grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {provinciaField}
          {cucinaField}
          {daField}
          {aField}
        </div>

        {error && (
          <p className="text-xs text-destructive" role="alert">{error}</p>
        )}

        {/* Radius slider — full width below when geo active */}
        {radiusBlock}

        {resetButton}
      </div>
    );
  }

  // =============================================
  // SIDEBAR VARIANT (cerca page — vertical layout)
  // =============================================
  return (
    <div className="space-y-4">
      {/* City search + radius: Airbnb-style grouped card */}
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3">
          {citySearchBlock}

          {error && (
            <p className="text-xs text-destructive" role="alert">{error}</p>
          )}

          {radiusBlock}
        </div>
      </div>

      {/* Filter grid — stacks vertically in sidebar on desktop */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1">
        {provinciaField}
        {cucinaField}
        {daField}
        {aField}
      </div>

      {resetButton}
    </div>
  );
}
