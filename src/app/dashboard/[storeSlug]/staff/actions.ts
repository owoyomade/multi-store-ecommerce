"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/lib/form-state";
import { toErrorFormState } from "@/server/action-errors";
import { requireStoreContext } from "@/server/auth/session";
import {
  changeMemberRole,
  inviteStaff,
  removeMember,
  revokeInvite,
} from "@/server/services/staff";

async function runStaffAction(
  storeSlug: string,
  formData: FormData | undefined,
  run: (
    context: Awaited<ReturnType<typeof requireStoreContext>>,
  ) => Promise<unknown>,
  successMessage: string,
): Promise<FormState> {
  const context = await requireStoreContext(storeSlug);
  try {
    await run(context);
  } catch (error) {
    return toErrorFormState(error, formData);
  }
  revalidatePath(`/dashboard/${storeSlug}/staff`);
  return { status: "success", message: successMessage };
}

export async function inviteStaffAction(
  storeSlug: string,
  _previous: FormState,
  formData: FormData,
) {
  const email = String(formData.get("email") ?? "");
  return runStaffAction(
    storeSlug,
    formData,
    (context) =>
      inviteStaff(context, { email, role: String(formData.get("role") ?? "") }),
    `Invitation sent to ${email.trim()}.`,
  );
}

export async function changeRoleAction(
  storeSlug: string,
  membershipId: string,
  _previous: FormState,
  formData: FormData,
) {
  return runStaffAction(
    storeSlug,
    formData,
    (context) =>
      changeMemberRole(context, membershipId, {
        role: String(formData.get("role") ?? ""),
      }),
    "Role updated.",
  );
}

export async function removeMemberAction(
  storeSlug: string,
  membershipId: string,
  _previous: FormState,
) {
  return runStaffAction(
    storeSlug,
    undefined,
    (context) => removeMember(context, membershipId),
    "Removed.",
  );
}

export async function revokeInviteAction(
  storeSlug: string,
  inviteId: string,
  _previous: FormState,
) {
  return runStaffAction(
    storeSlug,
    undefined,
    (context) => revokeInvite(context, inviteId),
    "Invitation cancelled.",
  );
}
