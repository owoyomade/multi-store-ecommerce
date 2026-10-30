import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoAccess } from "@/components/no-access";
import { Alert } from "@/components/ui/alert";
import { centsToInputValue } from "@/lib/money";
import { requireStoreContext } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { roleHasPermission } from "@/server/permissions/roles";
import {
  getProductForEdit,
  listCollections,
  MAX_IMAGES_PER_PRODUCT,
} from "@/server/services/catalog";
import { getStoreDetails } from "@/server/services/stores";
import { ProductStatusBadge } from "../product-status-badge";
import { CollectionsForm } from "./collections-form";
import { DetailsForm } from "./details-form";
import { ImagesSection } from "./images-section";
import { VariantsForm } from "./variants-form";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({
  params,
  searchParams,
}: PageProps<"/dashboard/[storeSlug]/products/[productId]">) {
  const { storeSlug, productId } = await params;
  const context = await requireStoreContext(storeSlug);
  if (!roleHasPermission(context.role, "catalog:edit")) {
    return (
      <NoAccess
        title="Edit product"
        message="Your role doesn't include managing products."
      />
    );
  }

  let product;
  try {
    product = await getProductForEdit(context, productId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  const [store, collections] = await Promise.all([
    getStoreDetails(context),
    listCollections(context),
  ]);
  const justCreated = (await searchParams).created === "1";

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href={`/dashboard/${storeSlug}/products`}
          className="text-sm text-stone-500 underline"
        >
          ← Products
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{product.title}</h1>
          <ProductStatusBadge status={product.status} />
          {product.status === "PUBLISHED" && (
            <Link
              href={`/s/${storeSlug}/products/${product.slug}`}
              className="text-sm underline"
              target="_blank"
            >
              View on storefront ↗
            </Link>
          )}
        </div>
      </div>

      {justCreated && (
        <Alert tone="success">
          Product created. Add images and fine-tune each variant below.
        </Alert>
      )}

      <DetailsForm
        storeSlug={storeSlug}
        productId={product.id}
        initialValues={{
          title: product.title,
          slug: product.slug,
          description: product.description,
          status: product.status,
          seoTitle: product.seoTitle ?? "",
          seoDescription: product.seoDescription ?? "",
        }}
      />

      <ImagesSection
        storeSlug={storeSlug}
        productId={product.id}
        images={product.images}
        canAddMore={product.images.length < MAX_IMAGES_PER_PRODUCT}
      />

      <VariantsForm
        storeSlug={storeSlug}
        productId={product.id}
        currency={store.currency}
        optionNames={product.options.map((option) => option.name)}
        variants={product.variants.map((variant) => ({
          id: variant.id,
          title: variant.title,
          sku: variant.sku,
          price: centsToInputValue(variant.priceCents),
          compareAtPrice:
            variant.compareAtPriceCents === null
              ? ""
              : centsToInputValue(variant.compareAtPriceCents),
          stock: variant.inventoryLevels.reduce(
            (sum, level) => sum + level.onHand,
            0,
          ),
          reserved: variant.inventoryLevels.reduce(
            (sum, level) => sum + level.reserved,
            0,
          ),
          trackInventory: variant.trackInventory,
        }))}
      />

      <CollectionsForm
        storeSlug={storeSlug}
        productId={product.id}
        collections={collections.map(({ id, title }) => ({ id, title }))}
        selectedIds={product.collections.map((link) => link.collectionId)}
      />
    </div>
  );
}
