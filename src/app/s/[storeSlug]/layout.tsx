import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import type { CSSProperties } from "react";
import { readableTextColor } from "@/lib/color";
import { getCart } from "@/server/services/cart";
import { listPublicCollections } from "@/server/services/storefront";
import { storefrontBasePath } from "@/server/storefront-path";
import { readCartToken } from "./cart-cookie";
import { loadStorefront } from "./load-store";

// Each theme gets its own heading typeface; body text stays on the system sans.
const classicHeading = Fraunces({
  subsets: ["latin"],
  variable: "--font-classic-heading",
});
const boldHeading = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-bold-heading",
});

export async function generateMetadata({
  params,
}: LayoutProps<"/s/[storeSlug]">): Promise<Metadata> {
  const store = await loadStorefront((await params).storeSlug);
  return {
    // `absolute` stops the platform's "· Storefront Studio" suffix being added.
    title: { absolute: store.name, template: `%s · ${store.name}` },
    description: store.tagline ?? `Shop ${store.name}`,
    // Draft-store previews must never end up in search results.
    robots: store.isPreview ? { index: false, follow: false } : undefined,
  };
}

export default async function StorefrontLayout({
  children,
  params,
}: LayoutProps<"/s/[storeSlug]">) {
  const { storeSlug } = await params;
  const store = await loadStorefront(storeSlug);
  const [collections, cart, base] = await Promise.all([
    listPublicCollections(store.id),
    getCart(store.id, await readCartToken(store.id)),
    storefrontBasePath(storeSlug),
  ]);

  const themeVariables = {
    "--sf-primary": store.primaryColor,
    "--sf-on-primary": readableTextColor(store.primaryColor),
    "--sf-accent": store.accentColor,
    "--sf-on-accent": readableTextColor(store.accentColor),
  } as CSSProperties;

  const navLinks = [
    { href: `${base}/products`, label: "Shop all" },
    ...collections.map((collection) => ({
      href: `${base}/collections/${collection.slug}`,
      label: collection.title,
    })),
  ];

  return (
    <div
      data-theme={store.theme}
      style={themeVariables}
      className={`storefront flex flex-1 flex-col ${classicHeading.variable} ${boldHeading.variable}`}
    >
      {store.isPreview && (
        <p
          className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900"
          role="status"
        >
          Preview — this store is a draft and only visible to its team.
        </p>
      )}

      <header className="bg-[var(--sf-primary)] text-[var(--sf-on-primary)]">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          <Link href={base || "/"} className="sf-heading text-xl font-semibold">
            {store.name}
          </Link>

          <nav
            aria-label="Store"
            className="ml-6 hidden flex-1 gap-5 text-sm md:flex"
          >
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="opacity-90 hover:underline hover:opacity-100"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3 md:ml-0">
            <Link
              href={`/s/${store.slug}/account`}
              className="hidden text-sm opacity-90 hover:underline sm:inline"
            >
              Account
            </Link>
            <form
              action={`${base}/products`}
              role="search"
              className="hidden sm:block"
            >
              <label htmlFor="store-search" className="sr-only">
                Search {store.name}
              </label>
              <input
                id="store-search"
                name="q"
                placeholder="Search"
                className="w-40 rounded-[var(--sf-radius)] border border-current/30 bg-white/10 px-3 py-1.5 text-sm placeholder:text-current/60 focus:bg-white/20 focus:outline-none"
              />
            </form>
            <Link
              href={`${base}/cart`}
              className="rounded-[var(--sf-radius)] bg-[var(--sf-accent)] px-3 py-1.5 text-sm font-medium text-[var(--sf-on-accent)]"
            >
              Cart{cart.itemCount > 0 && ` (${cart.itemCount})`}
              <span className="sr-only">, {cart.itemCount} items</span>
            </Link>
          </div>

          {/* A native <details> menu works without JavaScript and is keyboard accessible. */}
          <details className="relative md:hidden">
            <summary className="cursor-pointer list-none rounded-[var(--sf-radius)] border border-current/30 px-3 py-1.5 text-sm">
              Menu
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-64 rounded-[var(--sf-radius)] bg-white p-4 text-stone-900 shadow-lg">
              <form action={`${base}/products`} role="search" className="mb-3">
                <label htmlFor="store-search-mobile" className="sr-only">
                  Search {store.name}
                </label>
                <input
                  id="store-search-mobile"
                  name="q"
                  placeholder="Search products"
                  className="w-full rounded-md border border-stone-300 px-3 py-2 text-sm"
                />
              </form>
              <nav aria-label="Store (mobile)" className="flex flex-col gap-1">
                {[
                  ...navLinks,
                  { href: `/s/${store.slug}/account`, label: "Account" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="rounded-md px-2 py-2 text-sm hover:bg-stone-100"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
          </details>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        {children}
      </main>

      <footer className="border-t border-current/10">
        <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-4 px-4 py-8 text-sm opacity-70">
          <p>
            © {store.name} · Questions?{" "}
            <a href={`mailto:${store.contactEmail}`} className="underline">
              {store.contactEmail}
            </a>
          </p>
          <p>Powered by Storefront Studio</p>
        </div>
      </footer>
    </div>
  );
}
