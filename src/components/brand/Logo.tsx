import Image from "next/image";

interface LogoProps {
  className?: string;
}

/**
 * Nemovia logo using the custom SVG asset (bordeaux color palette).
 * Globe + fork pin icon with "NemoVia APP DELLE SAGRE DEL VENETO" wordmark.
 */
export function Logo({ className }: LogoProps) {
  return (
    <Image
      src="/logo-nemo-via.svg"
      alt="NemoVia - App delle sagre del Veneto"
      width={520}
      height={200}
      className={className}
      unoptimized
      priority
    />
  );
}
