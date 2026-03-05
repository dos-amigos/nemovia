import Link from "next/link";
import { Search } from "lucide-react";
import { FadeIn } from "@/components/animations/FadeIn";

export function HeroSection() {
  return (
    <FadeIn>
      <section className="rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-green-50 px-6 py-8">
        <h1 className="text-2xl font-bold text-foreground">
          Scopri le sagre del Veneto
        </h1>

        <p className="mt-2 text-muted-foreground">
          Trova sagre ed eventi gastronomici nella tua zona
        </p>

        <Link
          href="/cerca"
          className="mt-5 flex items-center gap-3 rounded-full border bg-white/80 px-4 py-3 text-muted-foreground shadow-sm transition-shadow hover:shadow-md"
        >
          <Search className="h-5 w-5 shrink-0" />
          <span className="text-sm">Cerca per nome, citta...</span>
        </Link>
      </section>
    </FadeIn>
  );
}
