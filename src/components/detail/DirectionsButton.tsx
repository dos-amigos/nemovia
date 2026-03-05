import { Navigation } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function getDirectionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

interface DirectionsButtonProps {
  lat: number;
  lng: number;
}

export default function DirectionsButton({ lat, lng }: DirectionsButtonProps) {
  return (
    <a
      href={getDirectionsUrl(lat, lng)}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
    >
      <Navigation className="size-4" />
      Indicazioni
    </a>
  );
}
