import Link from "next/link";
import { StripeBand } from "./stripe-band";

type BoldCardProps = {
  storeName: string;
  tagline: string;
  summary: string;
  actionLabel: string;
  shopHref: string;
  links: { href: string; label: string }[];
};

/** The printed card that opens the scrolling half: name, line, one action. */
export function BoldCard({
  storeName,
  tagline,
  summary,
  actionLabel,
  shopHref,
  links,
}: BoldCardProps) {
  return (
    <section
      aria-labelledby="store-title"
      className="relative -mt-9 flex flex-col bg-[var(--sf-paper-deep)] md:mt-0 md:min-h-[calc(100svh-24px)]"
    >
      <StripeBand />
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center sm:px-12 md:py-14">
        <h1
          id="store-title"
          data-reveal
          className="sf-heading text-[clamp(36px,4.6vw,80px)] leading-[0.95]"
        >
          {storeName}
        </h1>
        {tagline && (
          <p
            data-reveal
            style={{ ["--reveal-order" as string]: 1 }}
            className="mt-6 text-[22px]"
          >
            {tagline}
          </p>
        )}
        {summary && (
          <p
            data-reveal
            style={{ ["--reveal-order" as string]: 2 }}
            className="mt-4 max-w-[36ch] text-[17px] leading-relaxed"
          >
            {summary}
          </p>
        )}
        <Link
          href={shopHref}
          data-reveal
          style={{ ["--reveal-order" as string]: 3 }}
          className="mt-8 bg-[var(--sf-accent)] px-8 py-4 text-[17px] font-semibold text-[var(--sf-on-accent)] uppercase transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sf-ink)] active:translate-y-0 md:mt-10"
        >
          {actionLabel}
        </Link>
      </div>
      {links.length > 0 && (
        <nav
          aria-label="Collections"
          className="flex flex-wrap justify-center gap-x-8 gap-y-2 pb-8 text-base"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="underline-offset-4 hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </section>
  );
}
