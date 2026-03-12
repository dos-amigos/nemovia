"use client";

import { useRouter } from "next/navigation";
import * as m from "motion/react-m";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/animations/FadeIn";
import { QUICK_FILTER_CHIPS } from "@/lib/constants/veneto";

export function QuickFilters() {
  const router = useRouter();

  function handleChipClick(param: string, value: string) {
    const searchParams = new URLSearchParams();

    if (value === "today") {
      const today = new Date().toLocaleDateString("en-CA"); // yyyy-mm-dd local timezone
      searchParams.set(param, today);
      searchParams.set("a", today);
    } else {
      searchParams.set(param, value);
    }

    router.push(`/cerca?${searchParams.toString()}`);
  }

  return (
    <FadeIn delay={0.05}>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Cosa ti va?</h2>

        <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
          {QUICK_FILTER_CHIPS.map((chip) => (
            <m.button
              key={chip.label}
              type="button"
              className="rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/50"
              onClick={() => handleChipClick(chip.param, chip.value)}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <Badge
                variant="outline"
                className="cursor-pointer px-3 py-1.5 text-sm whitespace-nowrap hover:bg-secondary"
              >
                {chip.emoji} {chip.label}
              </Badge>
            </m.button>
          ))}
        </div>
      </section>
    </FadeIn>
  );
}
