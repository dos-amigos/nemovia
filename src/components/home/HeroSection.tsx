import Link from "next/link";
import { Search } from "lucide-react";
import { FadeIn } from "@/components/animations/FadeIn";

const heroMeshGradient = {
  background: [
    "radial-gradient(ellipse 80% 60% at 10% 15%, oklch(0.637 0.237 25.5 / 0.20), transparent 70%)",
    "radial-gradient(ellipse 60% 80% at 90% 80%, oklch(0.600 0.155 185 / 0.18), transparent 65%)",
    "radial-gradient(ellipse 40% 40% at 50% 40%, oklch(0.637 0.237 25.5 / 0.10), transparent 55%)",
    "oklch(0.985 0.005 260)",
  ].join(", "),
};

export function HeroSection() {
  return (
    <FadeIn>
      <section
        className="relative overflow-hidden rounded-2xl px-6 py-10 lg:px-10 lg:py-14"
        style={heroMeshGradient}
      >
        <h1 className="text-3xl font-bold text-foreground lg:text-4xl">
          Scopri le sagre del Veneto
        </h1>
        <p className="mt-2 text-muted-foreground lg:text-lg max-w-md">
          Trova sagre ed eventi gastronomici nella tua zona
        </p>
        <Link
          href="/cerca"
          className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/80 px-5 py-3 text-muted-foreground shadow-sm backdrop-blur-sm transition-shadow hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Search className="h-5 w-5 shrink-0" />
          <span className="text-sm">Cerca per nome, citta...</span>
        </Link>
      </section>
    </FadeIn>
  );
}
