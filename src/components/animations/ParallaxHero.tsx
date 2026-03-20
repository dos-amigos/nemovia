"use client";

import { useScroll, useTransform } from "motion/react";
import * as m from "motion/react-m";
import { useRef } from "react";

interface ParallaxHeroProps {
  children: React.ReactNode;
  className?: string;
}

export function ParallaxHero({ children, className }: ParallaxHeroProps) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 30]);
  // Gentle fade-out only at the very end (95-100%) to avoid abrupt clip
  // Image stays fully visible while scrolling through content
  const opacity = useTransform(scrollYProgress, [0, 0.95, 1], [1, 1, 0.7]);

  return (
    <div ref={ref} className={className}>
      {/* On mobile: subtle parallax + fade-out. On desktop: static (sticky layout). */}
      <m.div className="lg:!transform-none lg:!opacity-100" style={{ y, opacity }}>
        {children}
      </m.div>
    </div>
  );
}
