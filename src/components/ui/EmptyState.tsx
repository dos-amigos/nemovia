import { UtensilsCrossed } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
}

export function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        {icon ?? (
          <UtensilsCrossed className="h-8 w-8 text-muted-foreground" />
        )}
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 max-w-xs text-sm text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
