import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import { requireStoreContext } from "@/server/auth/session";
import { roleHasPermission } from "@/server/permissions/roles";
import { getStoreDetails } from "@/server/services/stores";
import { CreateProductForm } from "./create-product-form";

export const metadata: Metadata = { title: "Add product" };

export default async function NewProductPage({
  params,
}: PageProps<"/dashboard/[storeSlug]/products/new">) {
  const { storeSlug } = await params;
  const context = await requireStoreContext(storeSlug);
  if (!roleHasPermission(context.role, "catalog:edit")) {
    return (
      <NoAccess
        title="Add product"
        message="Your role doesn't include managing products."
      />
    );
  }
  const store = await getStoreDetails(context);

  return (
    <div className="max-w-2xl">
      <Link
        href={`/dashboard/${storeSlug}/products`}
        className="text-sm text-stone-500 underline"
      >
        ← Products
      </Link>
      <h1 className="mt-2 mb-6 text-2xl font-semibold">Add product</h1>
      <CreateProductForm storeSlug={storeSlug} currency={store.currency} />
    </div>
  );
}
