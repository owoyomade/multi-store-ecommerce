"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import type { VariantRowInput } from "@/lib/validation/catalog";
import { toErrorFormState } from "@/server/action-errors";
import { requireStoreContext } from "@/server/auth/session";
import {
  addProductImage,
  createProduct,
  deleteProductImage,
  setProductCollections,
  updateProductDetails,
  updateVariants,
} from "@/server/services/catalog";

// Each action re-checks the session and membership itself: server actions are
// public HTTP endpoints, and the storeSlug/productId arguments come from the
// page, so they only choose *what* to act on — the services decide whether
// the signed-in user may.

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function refreshCatalogPages(storeSlug: string, productId?: string) {
  revalidatePath(`/dashboard/${storeSlug}/products`);
  if (productId)
    revalidatePath(`/dashboard/${storeSlug}/products/${productId}`);
  revalidatePath(`/s/${storeSlug}`, "layout");
}

export async function createProductAction(
  storeSlug: string,
  _previous: FormState,
  formData: FormData,
) {
  const context = await requireStoreContext(storeSlug);
  let productId: string;
  try {
    const product = await createProduct(context, {
      title: text(formData, "title"),
      slug: text(formData, "slug"),
      description: text(formData, "description"),
      status: text(formData, "status") as "DRAFT" | "PUBLISHED",
      price: text(formData, "price"),
      compareAtPrice: text(formData, "compareAtPrice"),
      skuPrefix: text(formData, "skuPrefix"),
      initialStock: Number(text(formData, "initialStock") || 0),
      trackInventory: formData.get("trackInventory") === "on",
      option1Name: text(formData, "option1Name"),
      option1Values: text(formData, "option1Values"),
      option2Name: text(formData, "option2Name"),
      option2Values: text(formData, "option2Values"),
    });
    productId = product.id;
  } catch (error) {
    return toErrorFormState(error, formData);
  }
  refreshCatalogPages(storeSlug);
  redirect(`/dashboard/${storeSlug}/products/${productId}?created=1`);
}

export async function updateProductDetailsAction(
  storeSlug: string,
  productId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireStoreContext(storeSlug);
  try {
    await updateProductDetails(context, productId, {
      title: text(formData, "title"),
      slug: text(formData, "slug"),
      description: text(formData, "description"),
      status: text(formData, "status") as "DRAFT" | "PUBLISHED" | "ARCHIVED",
      seoTitle: text(formData, "seoTitle"),
      seoDescription: text(formData, "seoDescription"),
    });
  } catch (error) {
    return toErrorFormState(error, formData);
  }
  refreshCatalogPages(storeSlug, productId);
  return { status: "success", message: "Product saved." };
}

export async function updateVariantsAction(
  storeSlug: string,
  productId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireStoreContext(storeSlug);
  // Rows arrive as variantId[], price[], ... in the same order as the table.
  const ids = formData.getAll("variantId").map(String);
  const rows: VariantRowInput[] = ids.map((id) => ({
    id,
    sku: text(formData, `sku-${id}`),
    price: text(formData, `price-${id}`),
    compareAtPrice: text(formData, `compareAtPrice-${id}`),
    stock: Number(text(formData, `stock-${id}`) || 0),
    trackInventory: formData.get(`trackInventory-${id}`) === "on",
  }));

  try {
    await updateVariants(context, productId, rows);
  } catch (error) {
    return toErrorFormState(error, formData);
  }
  refreshCatalogPages(storeSlug, productId);
  return { status: "success", message: "Variants saved." };
}

export async function uploadProductImageAction(
  storeSlug: string,
  productId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireStoreContext(storeSlug);
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    return {
      status: "error",
      message: "Choose an image to upload.",
      fieldErrors: { image: ["Choose an image"] },
    };
  }

  try {
    await addProductImage(context, productId, {
      bytes: Buffer.from(await file.arrayBuffer()),
      altText: text(formData, "altText"),
    });
  } catch (error) {
    return toErrorFormState(error, formData);
  }
  refreshCatalogPages(storeSlug, productId);
  return { status: "success", message: "Image uploaded." };
}

export async function deleteProductImageAction(
  storeSlug: string,
  productId: string,
  imageId: string,
) {
  const context = await requireStoreContext(storeSlug);
  await deleteProductImage(context, imageId);
  refreshCatalogPages(storeSlug, productId);
}

export async function setProductCollectionsAction(
  storeSlug: string,
  productId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireStoreContext(storeSlug);
  try {
    await setProductCollections(
      context,
      productId,
      formData.getAll("collectionId").map(String),
    );
  } catch (error) {
    return toErrorFormState(error, formData);
  }
  refreshCatalogPages(storeSlug, productId);
  return { status: "success", message: "Collections saved." };
}
