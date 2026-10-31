import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/money";

type ProductCardProps = {
  href: string;
  currency: string;
  product: {
    title: string;
    minPriceCents: number;
    maxPriceCents: number;
    maxCompareAtCents: number | null;
    inStock: boolean;
    image: {
      storageKey: string;
      altText: string;
      width: number;
      height: number;
    } | null;
  };
};

export function ProductCard({ href, currency, product }: ProductCardProps) {
  const onSale =
    product.maxCompareAtCents !== null &&
    product.maxCompareAtCents > product.minPriceCents;

  return (
    <Link href={href} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-primary)]/10">
        {product.image ? (
          <Image
            src={`/media/${product.image.storageKey}`}
            alt={product.image.altText || product.title}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <span className="sf-heading absolute inset-0 flex items-center justify-center p-4 text-center text-lg opacity-60">
            {product.title}
          </span>
        )}
        {!product.inStock && (
          <span className="absolute top-2 left-2 rounded-[var(--sf-radius)] bg-black/75 px-2 py-1 text-xs font-medium text-white">
            Sold out
          </span>
        )}
        {product.inStock && onSale && (
          <span className="absolute top-2 left-2 rounded-[var(--sf-radius)] bg-[var(--sf-accent)] px-2 py-1 text-xs font-medium text-[var(--sf-on-accent)]">
            Sale
          </span>
        )}
      </div>
      <h2 className="mt-3 font-medium group-hover:underline">
        {product.title}
      </h2>
      <p className="text-sm">
        <span>
          {product.maxPriceCents > product.minPriceCents && "From "}
          {formatMoney(product.minPriceCents, currency)}
        </span>
        {onSale && product.maxCompareAtCents !== null && (
          <s className="ml-2 opacity-60">
            <span className="sr-only">Was </span>
            {formatMoney(product.maxCompareAtCents, currency)}
          </s>
        )}
      </p>
    </Link>
  );
}
