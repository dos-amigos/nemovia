import Image from "next/image";

interface LogoProps {
  className?: string;
}

/**
 * Nemovia logo using the custom PNG asset.
 * Globe + fork pin icon with "NemoVia APP DELLE SAGRE DEL VENETO" wordmark.
 */
export function Logo({ className }: LogoProps) {
  return (
    <Image
      src="/logo-nemo-via.png"
      alt="NemoVia - App delle sagre del Veneto"
      width={280}
      height={90}
      className={className}
      priority
    />
  );
}
