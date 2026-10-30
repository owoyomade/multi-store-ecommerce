"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import { toErrorFormState } from "@/server/action-errors";
import { requireStoreContext } from "@/server/auth/session";
import {
  createCollection,
  deleteCollection,
  updateCollection,
} from "@/server/services/catalog";

function collectionInput(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    slug: String(formData.get("slug") ?? ""),
    description: String(formData.get("description") ?? ""),
  };
}

function refresh(storeSlug: string) {
  revalidatePath(`/dashboard/${storeSlug}/collections`);
  revalidatePath(`/s/${storeSlug}`, "layout");
}

export async function createCollectionAction(
  storeSlug: string,
  _previous: FormState,
  formData: FormData,
) {
  const context = await requireStoreContext(storeSlug);
  try {
    await createCollection(context, collectionInput(formData));
  } catch (error) {
    return toErrorFormState(error, formData);
  }
  refresh(storeSlug);
  return {
    status: "success",
    message: "Collection created.",
  } satisfies FormState;
}

export async function updateCollectionAction(
  storeSlug: string,
  collectionId: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const context = await requireStoreContext(storeSlug);
  try {
    await updateCollection(context, collectionId, collectionInput(formData));
  } catch (error) {
    return toErrorFormState(error, formData);
  }
  refresh(storeSlug);
  return { status: "success", message: "Collection saved." };
}

export async function deleteCollectionAction(
  storeSlug: string,
  collectionId: string,
) {
  const context = await requireStoreContext(storeSlug);
  await deleteCollection(context, collectionId);
  refresh(storeSlug);
}
