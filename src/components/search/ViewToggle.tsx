"use client";

import { useState, useEffect } from "react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "griglia" | "lista";

export function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-lg border border-border bg-muted p-0.5">
      <button
        type="button"
        onClick={() => onChange("griglia")}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
          value === "griglia"
            ? "bg-background text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Vista griglia"
        aria-pressed={value === "griglia"}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange("lista")}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
          value === "lista"
            ? "bg-background text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Vista lista"
        aria-pressed={value === "lista"}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Hook to persist view mode in URL search params without nuqs */
export function useViewMode(): [ViewMode, (v: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>("griglia");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const v = params.get("vista");
    if (v === "lista") setMode("lista");
  }, []);

  const setViewMode = (v: ViewMode) => {
    setMode(v);
    const url = new URL(window.location.href);
    if (v === "griglia") {
      url.searchParams.delete("vista");
    } else {
      url.searchParams.set("vista", v);
    }
    window.history.replaceState({}, "", url.toString());
  };

  return [mode, setViewMode];
}
