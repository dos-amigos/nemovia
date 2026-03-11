import Link from "next/link";
import { FadeIn } from "@/components/animations/FadeIn";
import { ScrollRow } from "@/components/home/ScrollRow";
import type { SagraCardData } from "@/lib/queries/types";

const MIN_ROW_ITEMS = 3;

interface ScrollRowSectionProps {
  title: string;
  icon: React.ReactNode;
  sagre: SagraCardData[];
  viewAllHref?: string;
  delay?: number;
}

export function ScrollRowSection({
  title,
  icon,
  sagre,
  viewAllHref,
  delay = 0,
}: ScrollRowSectionProps) {
  if (sagre.length < MIN_ROW_ITEMS) return null;

  return (
    <FadeIn delay={delay}>
      <section className="space-y-3">
        {/* Title row inside max-w-7xl container */}
        <div className="flex items-center justify-between px-4 sm:px-6 lg:px-[calc(max(2rem,(100vw-80rem)/2+2rem))]">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            {icon}
            {title}
          </h2>
          {viewAllHref && (
            <Link
              href={viewAllHref}
              className="text-sm text-primary hover:underline"
            >
              Vedi tutti
            </Link>
          )}
        </div>

        {/* Full-width scroll container */}
        <ScrollRow sagre={sagre} ariaLabel={title} />
      </section>
    </FadeIn>
  );
}
