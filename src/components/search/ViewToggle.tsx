"use client";

import { parseAsStringEnum, useQueryState } from "nuqs";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewMode = "griglia" | "lista";

export const viewParser = parseAsStringEnum<ViewMode>(["griglia", "lista"]).withDefault("griglia");

export function ViewToggle() {
  const [vista, setVista] = useQueryState("vista", viewParser);

  return (
    <div className="flex gap-0.5 rounded-lg border border-border bg-muted p-0.5">
      <button
        type="button"
        onClick={() => setVista("griglia")}
        className={cn(
          "rounded-md p-1.5 transition-colors",
          vista === "griglia"
            ? "bg-background text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Vista griglia"
        aria-pressed={vista === "griglia"}
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => setVista("lista")}
        className={cn(
          "rounded-md p-1.5 transition-colors",
          vista === "lista"
            ? "bg-background text-primary shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        )}
        aria-label="Vista lista"
        aria-pressed={vista === "lista"}
      >
        <List className="h-4 w-4" />
      </button>
    </div>
  );
}
