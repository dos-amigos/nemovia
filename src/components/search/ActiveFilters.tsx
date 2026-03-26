"use client";

import { useQueryStates } from "nuqs";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { filterParsers } from "./filter-parsers";

export function ActiveFilters() {
  const [filters, setFilters] = useQueryStates(filterParsers, {
    shallow: false,
  });

  const hasGeo = filters.lat != null && filters.lng != null;

  const badges: Array<{ key: string; label: string; onRemove: () => void }> = [];

  if (filters.provincia) {
    badges.push({
      key: "provincia",
      label: filters.provincia,
      onRemove: () => setFilters({ provincia: null }),
    });
  }

  if (filters.cucina) {
    badges.push({
      key: "cucina",
      label: filters.cucina,
      onRemove: () => setFilters({ cucina: null }),
    });
  }

  if (filters.gratis) {
    badges.push({
      key: "gratis",
      label: "Solo gratis",
      onRemove: () => setFilters({ gratis: null }),
    });
  }

  if (filters.da && filters.a) {
    badges.push({
      key: "dates",
      label: `${filters.da} - ${filters.a}`,
      onRemove: () => setFilters({ da: null, a: null }),
    });
  } else if (filters.da) {
    badges.push({
      key: "da",
      label: `Dal ${filters.da}`,
      onRemove: () => setFilters({ da: null }),
    });
  } else if (filters.a) {
    badges.push({
      key: "a",
      label: `Fino al ${filters.a}`,
      onRemove: () => setFilters({ a: null }),
    });
  }

  if (hasGeo) {
    const geoLabel = filters.cityName
      ? `${filters.cityName} (${filters.raggio} km)`
      : `Vicino a me (${filters.raggio} km)`;
    badges.push({
      key: "geo",
      label: geoLabel,
      onRemove: () => setFilters({ lat: null, lng: null, raggio: null, cityName: null }),
    });
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <Badge
          key={badge.key}
          variant="secondary"
          className="gap-1 pl-2 pr-1"
        >
          {badge.label}
          <button
            type="button"
            onClick={badge.onRemove}
            className="-mr-1 ml-0.5 flex h-5 w-5 items-center justify-center rounded-full hover:bg-muted-foreground/20"
            aria-label={`Rimuovi filtro ${badge.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
