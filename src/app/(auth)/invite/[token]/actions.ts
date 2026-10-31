"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/lib/form-state";
import { toErrorFormState } from "@/server/action-errors";
import { requireUser } from "@/server/auth/session";
import { acceptInvite } from "@/server/services/staff";

export async function acceptInviteAction(
  token: string,
  _previous: FormState,
): Promise<FormState> {
  const user = await requireUser();
  let storeSlug: string;
  try {
    ({ storeSlug } = await acceptInvite(token, user.id));
  } catch (error) {
    return toErrorFormState(error);
  }
  redirect(`/dashboard/${storeSlug}`);
}
