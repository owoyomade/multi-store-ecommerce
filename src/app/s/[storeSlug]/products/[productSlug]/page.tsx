import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicProduct } from "@/server/services/storefront";
import { storefrontBasePath } from "@/server/storefront-path";
import { loadStorefront } from "../../load-store";
import { VariantPicker } from "./variant-picker";

export async function generateMetadata({
  params,
}: PageProps<"/s/[storeSlug]/products/[productSlug]">): Promise<Metadata> {
  const { storeSlug, productSlug } = await params;
  const store = await loadStorefront(storeSlug);
  const product = await getPublicProduct(store.id, productSlug);
  if (!product) return { title: "Product not found" };
  return {
    title: product.seoTitle || product.title,
    description:
      product.seoDescription || product.description.slice(0, 160) || undefined,
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/s/[storeSlug]/products/[productSlug]">) {
  const { storeSlug, productSlug } = await params;
  const store = await loadStorefront(storeSlug);
  const [product, base] = await Promise.all([
    getPublicProduct(store.id, productSlug),
    storefrontBasePath(storeSlug),
  ]);
  if (!product) notFound();

  const [mainImage, ...otherImages] = product.images;

  return (
    <div>
      <Link href={`${base}/products`} className="text-sm underline opacity-80">
        ← Shop all
      </Link>
      <div className="mt-4 grid gap-10 md:grid-cols-2">
        <div className="space-y-3">
          {mainImage ? (
            <Image
              src={`/media/${mainImage.storageKey}`}
              alt={mainImage.altText || product.title}
              width={mainImage.width}
              height={mainImage.height}
              sizes="(min-width: 768px) 50vw, 100vw"
              priority
              className="aspect-square w-full rounded-[var(--sf-radius)] object-cover"
            />
          ) : (
            <div className="sf-heading flex aspect-square items-center justify-center rounded-[var(--sf-radius)] bg-[var(--sf-primary)]/10 text-2xl opacity-60">
              {product.title}
            </div>
          )}
          {otherImages.length > 0 && (
            <ul className="grid grid-cols-4 gap-3">
              {otherImages.map((image) => (
                <li key={image.id}>
                  <Image
                    src={`/media/${image.storageKey}`}
                    alt={image.altText}
                    width={image.width}
                    height={image.height}
                    sizes="12vw"
                    className="aspect-square w-full rounded-[var(--sf-radius)] object-cover"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h1 className="sf-heading text-3xl font-semibold sm:text-4xl">
            {product.title}
          </h1>
          <VariantPicker
            storeSlug={storeSlug}
            cartHref={`${base}/cart`}
            currency={store.currency}
            options={product.options}
            variants={product.variants}
          />
          {product.description && (
            <div className="mt-10">
              <h2 className="sr-only">Description</h2>
              {/* React escapes text, so merchant-written descriptions can't inject HTML. */}
              <p className="leading-relaxed whitespace-pre-line opacity-90">
                {product.description}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
