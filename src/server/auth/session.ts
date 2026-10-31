import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  getStoreContextForUser,
  type StoreContext,
} from "../tenancy/store-context";
import { auth } from "./auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  platformRole: string;
  twoFactorEnabled: boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email, platformRole, twoFactorEnabled } = session.user;
  return {
    id,
    name,
    email,
    platformRole,
    twoFactorEnabled: twoFactorEnabled === true,
  };
}

/**
 * For pages that need a signed-in user. Sends everyone else to sign in.
 *
 * Platform admins can reach every store, so a stolen admin password would be
 * far more damaging than anyone else's. Until they turn on an authenticator
 * app they're sent to the security page instead of the dashboard.
 */
export async function requireUser(
  options: { allowMissingAdminTwoFactor?: boolean } = {},
): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (
    user.platformRole === "SUPER_ADMIN" &&
    !user.twoFactorEnabled &&
    !options.allowMissingAdminTwoFactor
  ) {
    redirect("/dashboard/security?required=1");
  }
  return user;
}

/**
 * For dashboard pages and actions under /dashboard/[storeSlug]. Non-members get
 * a 404 rather than a 403 so the response doesn't reveal that the store exists.
 */
export async function requireStoreContext(
  storeSlug: string,
): Promise<StoreContext> {
  const user = await requireUser();
  const context = await getStoreContextForUser(user.id, storeSlug);
  if (!context) notFound();
  return context;
}
