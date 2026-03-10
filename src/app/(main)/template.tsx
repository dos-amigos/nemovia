"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useSelectedLayoutSegment } from "next/navigation";
import { LayoutRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { useContext, useRef } from "react";

function usePreviousValue<T>(value: T): T | undefined {
  const ref = useRef<{ value: T; prev: T | undefined }>({
    value,
    prev: undefined,
  });

  if (ref.current.value !== value) {
    ref.current.prev = ref.current.value;
    ref.current.value = value;
  }

  return ref.current.prev;
}

function FrozenRouter({ children }: { children: React.ReactNode }) {
  const context = useContext(LayoutRouterContext);
  const prevContext = usePreviousValue(context);
  const segment = useSelectedLayoutSegment();
  const prevSegment = usePreviousValue(segment);

  const segmentChanged =
    prevSegment !== undefined && segment !== prevSegment;

  return (
    <LayoutRouterContext.Provider
      value={segmentChanged ? prevContext! : context!}
    >
      {children}
    </LayoutRouterContext.Provider>
  );
}

export default function Template({ children }: { children: React.ReactNode }) {
  const segment = useSelectedLayoutSegment();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <m.div
        key={segment}
        initial={{ opacity: 0 }}
        animate={{
          opacity: 1,
          transition: { duration: 0.15, ease: "easeOut" },
        }}
        exit={{ opacity: 0, transition: { duration: 0.1 } }}
      >
        <FrozenRouter>{children}</FrozenRouter>
      </m.div>
    </AnimatePresence>
  );
}
