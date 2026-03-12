/**
 * Clean inline SVG version of the pointer-nemo-via logo icon.
 * Globe + fork inside a map pin shape. Uses currentColor for fill.
 * Can be used as icon in scroll row titles, map markers, etc.
 */

interface NemoviaIconProps {
  className?: string;
  style?: React.CSSProperties;
}

export function NemoviaIcon({ className, style }: NemoviaIconProps) {
  return (
    <svg
      viewBox="0 0 24 32"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
      style={style}
    >
      {/* Map pin outer shape */}
      <path
        d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.4 18.6 0 12 0z"
        fillRule="evenodd"
      />
      {/* Globe grid lines (cut out in lighter color) */}
      <g fill="none" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.9">
        {/* Horizontal arcs */}
        <path d="M4.5 8.5h15" />
        <path d="M3.5 12h17" />
        <path d="M4.5 15.5h15" />
        {/* Vertical arcs */}
        <ellipse cx="12" cy="12" rx="4" ry="8" />
        {/* Outer circle */}
        <circle cx="12" cy="12" r="8" />
      </g>
      {/* Fork silhouette (white cut-out) */}
      <g fill="none" stroke="white" strokeWidth="1.6" strokeLinecap="round">
        <path d="M10.5 8v4" />
        <path d="M12 8v4" />
        <path d="M13.5 8v4" />
        <path d="M10.5 12c0 1 .7 1.5 1.5 1.5s1.5-.5 1.5-1.5" />
        <path d="M12 13.5v4" />
      </g>
    </svg>
  );
}
