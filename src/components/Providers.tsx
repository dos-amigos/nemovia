"use client";

import { MotionConfig } from "motion/react";
import { NuqsAdapter } from "nuqs/adapters/next/app";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <NuqsAdapter>{children}</NuqsAdapter>
    </MotionConfig>
  );
}
