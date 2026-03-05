import Link from "next/link";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { VENETO_PROVINCES } from "@/lib/constants/veneto";
import type { ProvinceCount } from "@/lib/queries/types";

interface ProvinceSectionProps {
  counts: ProvinceCount[];
}

export function ProvinceSection({ counts }: ProvinceSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Per provincia</h2>

      {counts.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-8 w-8 text-muted-foreground" />}
          title="Nessuna provincia disponibile"
          description="I dati delle province non sono ancora disponibili."
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {VENETO_PROVINCES.map((province) => {
            const match = counts.find((c) => c.province === province.name);
            const count = match?.count ?? 0;

            return (
              <Link
                key={province.code}
                href={`/cerca?provincia=${province.name}`}
                className="flex items-center justify-between rounded-lg border bg-card p-3 transition-shadow hover:shadow-sm"
              >
                <span className="text-sm font-medium">{province.name}</span>
                <Badge variant="secondary">{count}</Badge>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
