import type { ReactNode } from "react";

interface SagraGridProps {
  children: ReactNode;
}

export function SagraGrid({ children }: SagraGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
  );
}
