import Link from "next/link";

type BoldCollectionsProps = {
  base: string;
  collections: { slug: string; title: string }[];
};

/** The collections set as a poster: one per line, as large as the column allows. */
export function BoldCollections({ base, collections }: BoldCollectionsProps) {
  const lines = [
    ...collections.map((c) => ({
      href: `${base}/collections/${c.slug}`,
      label: c.title,
    })),
    { href: `${base}/products`, label: "Shop all" },
  ];

  return (
    <section
      aria-labelledby="collections-title"
      className="bg-[var(--sf-primary)] px-6 py-16 text-[var(--sf-on-primary)] sm:px-12 md:py-24"
    >
      <h2 id="collections-title" className="text-[22px] font-semibold">
        Shop by collection
      </h2>
      <ul className="mt-8">
        {lines.map((line, index) => (
          <li
            key={line.href}
            data-reveal
            style={{ ["--reveal-order" as string]: index }}
          >
            <Link
              href={line.href}
              className="sf-heading group inline-flex items-baseline gap-4 text-[clamp(40px,5.4vw,88px)] leading-[0.95] transition-transform hover:translate-x-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-current"
            >
              {line.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
