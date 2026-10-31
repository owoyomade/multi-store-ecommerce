import { useId } from "react";

/**
 * Alternating bars of the store's colour and paper, like the woven ribbon on
 * a garment label. The theme's only ornament.
 */
export function StripeBand({ height = 56 }: { height?: number }) {
  const patternId = useId();
  return (
    <svg aria-hidden width="100%" height={height} className="block">
      <defs>
        <pattern
          id={patternId}
          width="56"
          height={height}
          patternUnits="userSpaceOnUse"
        >
          <rect
            width="28"
            height={height}
            style={{ fill: "var(--sf-primary)" }}
          />
        </pattern>
      </defs>
      <rect width="100%" height={height} fill={`url(#${patternId})`} />
    </svg>
  );
}
