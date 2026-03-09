"use client";

import { motion, useScroll, useTransform } from "motion/react";
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
  const y = useTransform(scrollYProgress, [0, 1], [0, 60]);

  return (
    <div ref={ref} className={className}>
      {/* Hide on lg+ where sticky layout conflicts with parallax (Pitfall 5) */}
      {/* On mobile: parallax effect. On desktop: static (no transform). */}
      <motion.div className="lg:!transform-none" style={{ y }}>
        {children}
      </motion.div>
    </div>
  );
}
