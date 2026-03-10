"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";

const loadFeatures = () =>
  import("@/lib/motion-features").then((mod) => mod.default);

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">
        <NuqsAdapter>{children}</NuqsAdapter>
      </MotionConfig>
    </LazyMotion>
  );
}
