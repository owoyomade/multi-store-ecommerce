import Image from "next/image";
import Link from "next/link";
import type { StoreImage } from "@/lib/validation/storefront-content";

type ClassicHeroProps = {
  storeName: string;
  summary: string;
  facts: string[];
  photo: StoreImage | undefined;
  shopHref: string;
  actionLabel: string;
  storyHref: string | null;
};

/**
 * The store's label, set like the printed label on a bag of coffee or a
 * jar of honey, laid over a dimmed photograph of the store's world.
 * Without a photograph the label sits on the brand colour instead.
 */
export function ClassicHero({
  storeName,
  summary,
  facts,
  photo,
  shopHref,
  actionLabel,
  storyHref,
}: ClassicHeroProps) {
  return (
    <section aria-labelledby="store-title" className="classic-hero sf-bleed">
      <div className="classic-hero__stage flex items-center justify-center bg-[var(--sf-primary)] px-4">
        {photo && (
          <Image
            src={`/media/${photo.storageKey}`}
            alt=""
            fill
            priority
            sizes="100vw"
            className="classic-hero__photo"
          />
        )}

        <div className="classic-label relative flex w-full max-w-[920px] flex-col bg-[var(--sf-paper)] p-6 text-[var(--sf-primary)] sm:p-10 md:min-h-[62svh] md:w-[58vw]">
          <h1
            id="store-title"
            data-reveal
            className="sf-heading text-[clamp(44px,5.4vw,88px)] leading-[1.02]"
          >
            {storeName}
          </h1>

          <div
            data-reveal
            style={{ ["--reveal-order" as string]: 1 }}
            className="mt-6 grid gap-6 md:mt-10 md:grid-cols-2 md:gap-10"
          >
            {facts.length > 0 && (
              <ul className="space-y-1 text-[22px] leading-snug">
                {facts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            )}
            {summary && (
              <p className="max-w-[34ch] text-[22px] leading-snug">{summary}</p>
            )}
          </div>

          <div className="classic-perforation mt-8 md:mt-auto" aria-hidden />

          <div
            data-reveal
            style={{ ["--reveal-order" as string]: 2 }}
            className="mt-6 flex flex-wrap items-center justify-between gap-4"
          >
            <p className="text-base text-[var(--sf-muted)]">
              {photo?.caption
                ? `On the cover: ${photo.caption.toLowerCase()}`
                : "Shop online"}
            </p>
            <Link
              href={shopHref}
              className="bg-[var(--sf-accent)] px-7 py-3.5 text-[17px] text-[var(--sf-on-accent)] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sf-primary)] active:translate-y-0"
            >
              {actionLabel}
            </Link>
            {storyHref ? (
              <a
                href={storyHref}
                className="text-[17px] underline underline-offset-4"
              >
                Read our story
              </a>
            ) : (
              <span aria-hidden />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
