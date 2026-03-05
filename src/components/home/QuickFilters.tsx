"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { QUICK_FILTER_CHIPS } from "@/lib/constants/veneto";

export function QuickFilters() {
  const router = useRouter();

  function handleChipClick(param: string, value: string) {
    const searchParams = new URLSearchParams();

    if (value === "today") {
      const today = new Date().toISOString().split("T")[0];
      searchParams.set(param, today);
      searchParams.set("a", today);
    } else {
      searchParams.set(param, value);
    }

    router.push(`/cerca?${searchParams.toString()}`);
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Cosa ti va?</h2>

      <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
        {QUICK_FILTER_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => handleChipClick(chip.param, chip.value)}
          >
            <Badge
              variant="outline"
              className="cursor-pointer px-3 py-1.5 text-sm whitespace-nowrap hover:bg-secondary"
            >
              {chip.emoji} {chip.label}
            </Badge>
          </button>
        ))}
      </div>
    </section>
  );
}
