"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SearchFilters } from "@/components/search/SearchFilters";

export default function MapFilterOverlay() {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute top-3 left-3 z-[1000]">
      {open ? (
        <div className="glass-overlay rounded-lg shadow-lg p-3 max-w-[280px]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Filtri</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <SearchFilters />
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="glass-overlay shadow-md"
          onClick={() => setOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtri
        </Button>
      )}
    </div>
  );
}
