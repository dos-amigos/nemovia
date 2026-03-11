interface LogoProps {
  className?: string;
}

/**
 * Nemovia inline SVG logo.
 *
 * - Teal map-pin/fork icon on the left using var(--accent)
 * - Coral "Nemovia" wordmark on the right using var(--primary)
 * - Path-based letterforms for consistent rendering (no font embedding)
 * - Accessible: aria-label + role="img"
 */
export function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 140 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Nemovia"
      role="img"
      className={className}
    >
      {/* Icon: stylised map pin with fork silhouette */}
      <g fill="var(--accent)">
        {/* Map pin outer shape */}
        <path d="M10 2C5.6 2 2 5.6 2 10c0 5.5 8 14 8 14s8-8.5 8-14c0-4.4-3.6-8-8-8z" />
        {/* Fork tines cut-out (lighter colour via background bleed) */}
        <path
          d="M8 7v5.5M10 7v5.5M12 7v5.5M10 12.5v4"
          stroke="var(--background)"
          strokeWidth="1.3"
          strokeLinecap="round"
          fill="none"
        />
      </g>

      {/* Wordmark: "Nemovia" in geometric sans-serif paths */}
      <g fill="var(--primary)">
        {/* N */}
        <path d="M26 8h2.2v16H26l-5.5-11.2V24H18.3V8h2.2l5.5 11.2V8z" />
        {/* e */}
        <path d="M34.2 14.4c2.6 0 4.5 2 4.5 5.1v.9h-7c.3 2 1.5 3 3.1 3 1.1 0 2-.4 2.8-1.2l1.1 1.4c-1 1-2.3 1.6-4 1.6-3 0-5.1-2.2-5.1-5.4 0-3.2 2.1-5.4 4.6-5.4zm-2.5 4.5h5c-.2-1.7-1.2-2.8-2.5-2.8s-2.3 1.1-2.5 2.8z" />
        {/* m */}
        <path d="M41.4 14.7h2v1.7c.7-1.2 1.8-1.9 3.1-1.9 1.4 0 2.3.7 2.8 2 .8-1.3 2-2 3.3-2 2 0 3.1 1.3 3.1 3.7V24h-2v-5.5c0-1.5-.6-2.3-1.7-2.3-1.2 0-2.1 1-2.1 2.6V24h-2v-5.5c0-1.5-.6-2.3-1.7-2.3-1.2 0-2.1 1-2.1 2.6V24h-2V14.7z" />
        {/* o */}
        <path d="M62.3 14.4c3 0 5.1 2.2 5.1 5.4s-2.1 5.4-5.1 5.4c-3 0-5.1-2.2-5.1-5.4s2.1-5.4 5.1-5.4zm0 8.8c1.7 0 3-1.3 3-3.4s-1.3-3.4-3-3.4-3 1.3-3 3.4 1.3 3.4 3 3.4z" />
        {/* v */}
        <path d="M73.1 14.7h2.2l-3.8 9.6h-2.2l-3.8-9.6h2.2l2.7 7.2 2.7-7.2z" />
        {/* i */}
        <path d="M76.5 8h2.1v2.4h-2.1V8zm.1 6.7H78.6V24h-2V14.7z" />
        {/* a */}
        <path d="M85.5 14.4c2.6 0 4.3 2 4.3 5.2V24h-2v-1.4c-.7 1-1.8 1.6-3.2 1.6-2 0-3.5-1.2-3.5-3.1 0-1.9 1.5-3.1 4-3.1h2.6v-.4c0-1.6-1-2.5-2.6-2.5-1.1 0-2.2.4-3 1.2l-1-1.5c1.1-1 2.6-1.5 4.4-1.5zm-.5 8.2c1.3 0 2.3-.7 2.8-1.8v-1.5h-2.5c-1.5 0-2.3.6-2.3 1.7 0 1 .8 1.6 2 1.6z" />
      </g>
    </svg>
  );
}
