"use client";

import { parseAsStringEnum, useQueryState } from "nuqs";
import { List, Map } from "lucide-react";
import { Button } from "@/components/ui/button";

type ViewMode = "lista" | "mappa";

export function ViewToggle() {
  const [vista, setVista] = useQueryState(
    "vista",
    parseAsStringEnum<ViewMode>(["lista", "mappa"]).withDefault("lista")
  );

  return (
    <div className="flex gap-1">
      <Button
        variant={vista === "lista" ? "default" : "outline"}
        size="sm"
        onClick={() => setVista("lista")}
      >
        <List className="h-4 w-4" />
        Lista
      </Button>
      <Button
        variant={vista === "mappa" ? "default" : "outline"}
        size="sm"
        onClick={() => setVista("mappa")}
      >
        <Map className="h-4 w-4" />
        Mappa
      </Button>
    </div>
  );
}
