"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import {
  PICTURE_SLOTS,
  type PictureSlot,
} from "@/lib/validation/storefront-content";
import { toErrorFormState } from "@/server/action-errors";
import { requireStoreContext } from "@/server/auth/session";
import {
  removeHomepagePicture,
  setHomepagePicture,
  updateHomepageText,
} from "@/server/services/storefront-content";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function refresh(storeSlug: string) {
  revalidatePath(`/dashboard/${storeSlug}/homepage`);
  revalidatePath(`/s/${storeSlug}`, "layout");
}

// The slot comes from the page, so it is checked against the known list
// rather than trusted.
function assertSlot(slot: string): asserts slot is PictureSlot {
  if (!(PICTURE_SLOTS as readonly string[]).includes(slot))
    throw new Error(`Unknown picture slot: ${slot}`);
}

export async function saveHomepageTextAction(
  storeSlug: string,
  _previous: FormState,
  formData: FormData,
) {
  const context = await requireStoreContext(storeSlug);
  try {
    await updateHomepageText(context, {
      summary: text(formData, "summary"),
      actionLabel: text(formData, "actionLabel"),
      facts: [
        text(formData, "fact1"),
        text(formData, "fact2"),
        text(formData, "fact3"),
      ],
      featuredProductSlug: text(formData, "featuredProductSlug"),
      letterText: text(formData, "letterText"),
      letterSignedBy: text(formData, "letterSignedBy"),
      letterRole: text(formData, "letterRole"),
    });
  } catch (error) {
    return toErrorFormState(error, formData);
  }
  refresh(storeSlug);
  return { status: "success", message: "Homepage saved." } satisfies FormState;
}

export async function saveHomepagePictureAction(
  storeSlug: string,
  slot: string,
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  assertSlot(slot);
  const context = await requireStoreContext(storeSlug);
  const file = formData.get("image");
  try {
    await setHomepagePicture(context, slot, {
      bytes:
        file instanceof File && file.size > 0
          ? Buffer.from(await file.arrayBuffer())
          : null,
      alt: text(formData, "alt"),
      caption: text(formData, "caption"),
      credit: text(formData, "credit"),
    });
  } catch (error) {
    return toErrorFormState(error, formData);
  }
  refresh(storeSlug);
  return { status: "success", message: "Picture saved." };
}

export async function removeHomepagePictureAction(
  storeSlug: string,
  slot: string,
) {
  assertSlot(slot);
  const context = await requireStoreContext(storeSlug);
  await removeHomepagePicture(context, slot);
  refresh(storeSlug);
}
