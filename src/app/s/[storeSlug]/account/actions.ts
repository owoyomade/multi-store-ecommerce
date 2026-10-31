"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/server/auth/session";
import { deleteAddressForShopper } from "@/server/services/orders";
import { loadStorefront } from "../load-store";

export async function deleteAddressAction(
  storeSlug: string,
  addressId: string,
) {
  const [store, user] = await Promise.all([
    loadStorefront(storeSlug),
    // Shopping as a customer isn't an admin action.
    requireUser({ allowMissingAdminTwoFactor: true }),
  ]);
  await deleteAddressForShopper(store.id, user.id, addressId);
  revalidatePath(`/s/${storeSlug}/account`);
}
