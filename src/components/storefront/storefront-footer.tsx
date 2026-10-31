import Image from "next/image";
import Link from "next/link";
import {
  contentCredits,
  type StorefrontContent,
} from "@/lib/validation/storefront-content";

type FooterProps = {
  store: {
    name: string;
    theme: "CLASSIC" | "BOLD";
    slug: string;
    contactEmail: string;
    content: StorefrontContent;
  };
  base: string;
  collections: { slug: string; title: string }[];
};

/**
 * The storefront's closing section: the store name set large, ways to reach
 * the store, the shop links, and a credit for every found picture used on
 * the homepage (most open licences require one).
 */
export function StorefrontFooter(props: FooterProps) {
  return props.store.theme === "BOLD" ? (
    <SplitFooter {...props} />
  ) : (
    <NameFirstFooter {...props} />
  );
}

/** Classic: the store name opens the footer at full width, places under it. */
function NameFirstFooter({ store, base, collections }: FooterProps) {
  const credits = contentCredits(store.content);
  const picture = store.content.footerImage;

  return (
    <footer className="bg-[var(--sf-primary)] text-[var(--sf-on-primary)]">
      <div className="sf-container pt-16 pb-10 md:pt-24">
        <p
          aria-hidden
          data-reveal
          className="sf-heading text-[clamp(40px,11vw,184px)] leading-[0.95] md:whitespace-nowrap"
        >
          {store.name}
        </p>

        <div className="mt-14 grid gap-12 md:grid-cols-12">
          <div
            data-reveal
            style={{ ["--reveal-order" as string]: 1 }}
            className="md:col-span-5"
          >
            <h2 className="sr-only">Contact {store.name}</h2>
            <a
              href={`mailto:${store.contactEmail}`}
              className="text-[22px] text-[var(--sf-accent)] underline-offset-4 hover:underline"
            >
              {store.contactEmail}
            </a>
            {store.content.facts.length > 0 && (
              <ul className="mt-6 space-y-1 text-[17px]">
                {store.content.facts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            )}
          </div>

          <nav
            aria-label="Footer"
            data-reveal
            style={{ ["--reveal-order" as string]: 2 }}
            className="md:col-span-3"
          >
            <h2 className="mb-3 text-[17px] font-semibold">Shop</h2>
            <ul className="space-y-2 text-[17px]">
              <li>
                <Link href={`${base}/products`} className="hover:underline">
                  Shop all
                </Link>
              </li>
              {collections.map((collection) => (
                <li key={collection.slug}>
                  <Link
                    href={`${base}/collections/${collection.slug}`}
                    className="hover:underline"
                  >
                    {collection.title}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href={`/s/${store.slug}/account`}
                  className="hover:underline"
                >
                  Your account
                </Link>
              </li>
            </ul>
          </nav>

          {picture && (
            <figure
              data-reveal
              style={{ ["--reveal-order" as string]: 3 }}
              className="md:col-span-4"
            >
              <Image
                src={`/media/${picture.storageKey}`}
                alt={picture.alt}
                width={picture.width}
                height={picture.height}
                sizes="(min-width: 768px) 30vw, 100vw"
                className="w-full"
              />
              {picture.caption && (
                <figcaption className="mt-2 text-base">
                  {picture.caption}
                </figcaption>
              )}
            </figure>
          )}
        </div>

        <div className="mt-16 flex flex-wrap items-end justify-between gap-6 text-base">
          <div className="max-w-[68ch] space-y-1">
            <p>
              © {new Date().getFullYear()} {store.name}. Powered by Storefront
              Studio.
            </p>
            {credits.length > 0 && <p>Pictures: {credits.join("; ")}.</p>}
          </div>
          <a href="#top" className="underline-offset-4 hover:underline">
            Back to top
          </a>
        </div>
      </div>
    </footer>
  );
}

/**
 * Bold: one half is a photograph cropped hard by the edges, the other half is
 * the site's menu set large, with contact details and credits beneath.
 */
function SplitFooter({ store, base, collections }: FooterProps) {
  const credits = contentCredits(store.content);
  const picture = store.content.footerImage;
  const menu = [
    { href: `${base}/products`, label: "Shop all" },
    ...collections.map((c) => ({
      href: `${base}/collections/${c.slug}`,
      label: c.title,
    })),
    { href: `/s/${store.slug}/account`, label: "Account" },
  ];

  return (
    <footer className="grid bg-[var(--sf-primary)] text-[var(--sf-on-primary)] md:min-h-svh md:grid-cols-2">
      {picture && (
        <figure className="relative h-[50svh] md:h-auto">
          <Image
            src={`/media/${picture.storageKey}`}
            alt={picture.alt}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
          {picture.caption && (
            <figcaption className="absolute bottom-3 left-3 bg-[var(--sf-paper)] px-3 py-1.5 text-base text-[var(--sf-ink)]">
              {picture.caption}
            </figcaption>
          )}
        </figure>
      )}
      <div className="flex flex-col px-6 py-14 sm:px-12 md:py-20">
        <p className="sf-heading text-[22px]">{store.name}</p>
        <nav aria-label="Footer" className="mt-10">
          <ul className="space-y-3">
            {menu.map((item, index) => (
              <li
                key={item.href}
                data-reveal
                style={{ ["--reveal-order" as string]: index }}
              >
                <Link
                  href={item.href}
                  className="sf-heading inline-block text-[clamp(32px,3.2vw,48px)] leading-none transition-transform hover:translate-x-3"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-14 grid gap-8 text-base sm:grid-cols-2">
          <div>
            <h2 className="mb-2 font-semibold">Contact</h2>
            <a
              href={`mailto:${store.contactEmail}`}
              className="underline underline-offset-4"
            >
              {store.contactEmail}
            </a>
          </div>
          {store.content.facts.length > 0 && (
            <div>
              <h2 className="mb-2 font-semibold">Good to know</h2>
              <ul className="space-y-1">
                {store.content.facts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="mt-auto space-y-1 pt-14 text-base">
          <p>
            © {new Date().getFullYear()} {store.name}. Powered by Storefront
            Studio.{" "}
            <a href="#top" className="underline underline-offset-4">
              Back to top
            </a>
          </p>
          {credits.length > 0 && (
            <p className="max-w-[68ch]">Pictures: {credits.join("; ")}.</p>
          )}
        </div>
      </div>
    </footer>
  );
}
