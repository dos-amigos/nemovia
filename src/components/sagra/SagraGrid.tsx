import type { ReactNode } from "react";
import { StaggerGrid } from "@/components/animations/StaggerGrid";

interface SagraGridProps {
  children: ReactNode;
}

export function SagraGrid({ children }: SagraGridProps) {
  return <StaggerGrid>{children}</StaggerGrid>;
}
