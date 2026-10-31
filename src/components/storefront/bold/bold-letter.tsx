import Image from "next/image";
import type { StoreImage } from "@/lib/validation/storefront-content";

type BoldLetterProps = {
  letter: { paragraphs: string[]; signedBy: string; role: string };
  plate: StoreImage | undefined;
};

/** The founder's letter as a plain column of text, with one picture after it. */
export function BoldLetter({ letter, plate }: BoldLetterProps) {
  return (
    <section
      id="story"
      aria-labelledby="letter-title"
      className="bg-[var(--sf-paper-deep)] px-6 py-16 sm:px-12 md:py-24"
    >
      <div data-reveal className="mx-auto max-w-[34em]">
        <h2
          id="letter-title"
          className="sf-heading text-[clamp(32px,3vw,44px)] leading-none"
        >
          From the founder
        </h2>
        <div className="mt-8 space-y-5 text-[17px] leading-[1.6]">
          {letter.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <p className="mt-8 text-[22px] font-semibold">{letter.signedBy}</p>
        {letter.role && <p className="text-base">{letter.role}</p>}
      </div>
      {plate && (
        <figure
          data-reveal
          style={{ ["--reveal-order" as string]: 1 }}
          className="mx-auto mt-14 max-w-[34em]"
        >
          <Image
            src={`/media/${plate.storageKey}`}
            alt={plate.alt}
            width={plate.width}
            height={plate.height}
            sizes="(min-width: 768px) 40vw, 100vw"
            className="w-full"
          />
          {plate.caption && (
            <figcaption className="mt-3 text-base">{plate.caption}</figcaption>
          )}
        </figure>
      )}
    </section>
  );
}
