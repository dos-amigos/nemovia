"use client";

import { useQueryStates, parseAsString, parseAsInteger, parseAsBoolean } from "nuqs";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

const filterParsers = {
  provincia: parseAsString,
  raggio: parseAsInteger.withDefault(30),
  cucina: parseAsString,
  gratis: parseAsBoolean,
  da: parseAsString,
  a: parseAsString,
  lat: parseAsString,
  lng: parseAsString,
};

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
    badges.push({
      key: "geo",
      label: `Vicino a me (${filters.raggio} km)`,
      onRemove: () => setFilters({ lat: null, lng: null, raggio: null }),
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
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
            aria-label={`Rimuovi filtro ${badge.label}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}
