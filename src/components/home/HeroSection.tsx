import Link from "next/link";
import { Search } from "lucide-react";
import { FadeIn } from "@/components/animations/FadeIn";

export function HeroSection() {
  return (
    <FadeIn>
      <section className="rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-green-50 px-6 py-8 lg:px-10 lg:py-12">
        <h1 className="text-2xl font-bold text-foreground lg:text-3xl">
          Scopri le sagre del Veneto
        </h1>

        <p className="mt-2 text-muted-foreground lg:text-lg">
          Trova sagre ed eventi gastronomici nella tua zona
        </p>

        <Link
          href="/cerca"
          className="mt-5 flex items-center gap-3 rounded-full border bg-white/80 px-4 py-3 text-muted-foreground shadow-sm transition-shadow hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Search className="h-5 w-5 shrink-0" />
          <span className="text-sm">Cerca per nome, citta...</span>
        </Link>
      </section>
    </FadeIn>
  );
}
