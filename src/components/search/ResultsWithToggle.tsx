"use client";

import { useState, useEffect } from "react";
import { LayoutGrid, List } from "lucide-react";
import { SagraCard } from "@/components/sagra/SagraCard";
import { SagraListItem } from "@/components/sagra/SagraListItem";
import { SagraGrid } from "@/components/sagra/SagraGrid";
import { cn } from "@/lib/utils";
import type { SagraCardData } from "@/lib/queries/types";

type ViewMode = "griglia" | "lista";

export function ResultsWithToggle({ sagre }: { sagre: SagraCardData[] }) {
  const [vista, setVista] = useState<ViewMode>("griglia");

  // Read initial view from URL on mount
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get("vista");
    if (v === "lista") setVista("lista");
  }, []);

  const changeView = (v: ViewMode) => {
    setVista(v);
    const url = new URL(window.location.href);
    if (v === "griglia") url.searchParams.delete("vista");
    else url.searchParams.set("vista", v);
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <div className="space-y-3">
      {/* Header: count + toggle */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sagre.length} {sagre.length === 1 ? "sagra trovata" : "sagre trovate"}
        </p>
        <div className="flex gap-0.5 rounded-lg border border-border bg-muted p-0.5">
          <button
            type="button"
            onClick={() => changeView("griglia")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              vista === "griglia"
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Vista griglia"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => changeView("lista")}
            className={cn(
              "rounded-md p-1.5 transition-colors",
              vista === "lista"
                ? "bg-background text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label="Vista lista"
          >
            <List className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content: grid or list */}
      {vista === "lista" ? (
        <div className="flex flex-col gap-2">
          {sagre.map((sagra) => (
            <SagraListItem key={sagra.id} sagra={sagra} distanceKm={sagra.distance_km} />
          ))}
        </div>
      ) : (
        <SagraGrid>
          {sagre.map((sagra) => (
            <SagraCard key={sagra.id} sagra={sagra} distanceKm={sagra.distance_km} />
          ))}
        </SagraGrid>
      )}
    </div>
  );
}
