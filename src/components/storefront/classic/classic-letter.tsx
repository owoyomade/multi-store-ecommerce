import Image from "next/image";
import type { StoreImage } from "@/lib/validation/storefront-content";
import { Scallops } from "./scallops";

type ClassicLetterProps = {
  letter: {
    paragraphs: string[];
    signedBy: string;
    role: string;
    image?: StoreImage;
  };
  backdrop: StoreImage | undefined;
  plate: StoreImage | undefined;
  contactEmail: string;
};

/**
 * The founder's letter on a paper sheet with a tear-off strip, laid on a
 * photograph of the store's world, with one picture tipped in beside it.
 */
export function ClassicLetter({
  letter,
  backdrop,
  plate,
  contactEmail,
}: ClassicLetterProps) {
  const firstName = letter.signedBy.split(" ")[0];

  return (
    <section
      id="story"
      aria-labelledby="letter-title"
      className="sf-bleed relative overflow-hidden bg-[var(--sf-primary)]"
    >
      {backdrop && (
        <Image
          src={`/media/${backdrop.storageKey}`}
          alt={backdrop.alt}
          fill
          sizes="100vw"
          className="object-cover brightness-[0.55]"
        />
      )}

      <div className="sf-container relative grid gap-10 py-24 md:grid-cols-12 md:items-start md:py-36">
        <article
          data-reveal
          style={{ ["--reveal-order" as string]: 0 }}
          className="relative bg-[var(--sf-paper)] px-7 pt-12 pb-10 sm:px-14 md:col-span-7 md:col-start-1 lg:col-span-6 lg:col-start-2"
        >
          {letter.image && (
            <Image
              src={`/media/${letter.image.storageKey}`}
              alt={letter.image.alt}
              width={letter.image.width}
              height={letter.image.height}
              sizes="(min-width: 768px) 14vw, 40vw"
              className="mb-6 w-1/2 sm:float-right sm:mb-4 sm:ml-6 sm:w-[30%]"
            />
          )}
          <h2
            id="letter-title"
            className="sf-heading text-[clamp(32px,3vw,44px)] leading-[1.05]"
          >
            A note from {firstName}
          </h2>
          <div className="mt-8 space-y-5 text-[17px] leading-[1.6]">
            {letter.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <p className="mt-8 text-[22px] italic">{letter.signedBy}</p>
          {letter.role && (
            <p className="text-base text-[var(--sf-muted)]">{letter.role}</p>
          )}
          {letter.image?.caption && (
            <p className="clear-both mt-6 text-base text-[var(--sf-muted)]">
              Pictured: {letter.image.caption}
            </p>
          )}

          <div className="classic-perforation mt-10" aria-hidden />
          <p className="mt-5 flex flex-wrap items-baseline justify-between gap-3 text-[17px]">
            <span>Write to {firstName}</span>
            <a
              href={`mailto:${contactEmail}`}
              className="underline underline-offset-4"
            >
              {contactEmail}
            </a>
          </p>
          <Scallops edge="bottom" />
        </article>

        {plate && (
          <figure
            data-reveal
            style={{ ["--reveal-order" as string]: 2 }}
            className="md:col-span-5 lg:col-span-4 lg:col-start-9"
          >
            <Image
              src={`/media/${plate.storageKey}`}
              alt={plate.alt}
              width={plate.width}
              height={plate.height}
              sizes="(min-width: 768px) 30vw, 100vw"
              className="w-full"
            />
            {plate.caption && (
              <figcaption className="mt-3 bg-[var(--sf-paper)] px-3 py-2 text-base">
                {plate.caption}
              </figcaption>
            )}
          </figure>
        )}
      </div>

      {backdrop?.caption && (
        <p className="sf-container relative pb-6 text-base text-white">
          Behind: {backdrop.caption}
        </p>
      )}
    </section>
  );
}
