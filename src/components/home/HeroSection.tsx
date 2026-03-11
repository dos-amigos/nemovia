import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { FadeIn } from "@/components/animations/FadeIn";
import { getHeroImage } from "@/lib/unsplash";

export function HeroSection() {
  const hero = getHeroImage();

  return (
    <FadeIn>
      <section className="relative mx-4 h-[280px] overflow-hidden rounded-2xl sm:h-[340px] lg:mx-6 lg:h-[400px]">
        <Image
          src={hero.url}
          alt="Sagre del Veneto"
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />

        {/* Dark gradient overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20" />

        {/* Content overlay */}
        <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
          <h1 className="text-3xl font-bold text-white drop-shadow-lg lg:text-5xl">
            SCOPRI LE SAGRE DEL VENETO
          </h1>
          <p className="mt-3 max-w-lg text-white/80 lg:text-lg">
            Trova sagre ed eventi gastronomici nella tua zona
          </p>
          <Link
            href="/cerca"
            className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/30 bg-white/20 px-5 py-3 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
          >
            <Search className="h-5 w-5" />
            <span>Cerca per nome, citta...</span>
          </Link>
        </div>

        {/* Unsplash photographer attribution */}
        <div className="absolute bottom-2 right-3 z-10 text-[10px] text-white/50">
          Photo by{" "}
          <a
            href={hero.photographerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white/70"
          >
            {hero.photographer}
          </a>{" "}
          on{" "}
          <a
            href={hero.unsplashUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-white/70"
          >
            Unsplash
          </a>
        </div>
      </section>
    </FadeIn>
  );
}
