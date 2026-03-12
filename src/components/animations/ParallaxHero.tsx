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
  // Smooth fade-out as the hero scrolls off screen (avoids abrupt clip)
  const opacity = useTransform(scrollYProgress, [0, 0.7, 1], [1, 1, 0]);

  return (
    <div ref={ref} className={className}>
      {/* On mobile: subtle parallax + fade-out. On desktop: static (sticky layout). */}
      <m.div className="lg:!transform-none lg:!opacity-100" style={{ y, opacity }}>
        {children}
      </m.div>
    </div>
  );
}
