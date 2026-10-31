import { useId } from "react";

/** The scalloped edge of a printed sheet, in the theme's paper colour. */
export function Scallops({ edge }: { edge: "top" | "bottom" }) {
  const patternId = useId();
  return (
    <svg
      aria-hidden
      className={`classic-scallops classic-scallops--${edge}`}
      preserveAspectRatio="none"
    >
      <defs>
        <pattern
          id={patternId}
          width="22"
          height="14"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="11" cy="0" r="7.5" style={{ fill: "var(--sf-paper)" }} />
        </pattern>
      </defs>
      <rect width="100%" height="14" fill={`url(#${patternId})`} />
    </svg>
  );
}
