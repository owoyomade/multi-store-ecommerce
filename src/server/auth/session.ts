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
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const { id, name, email, platformRole } = session.user;
  return { id, name, email, platformRole };
}

/** For pages that need a signed-in user. Sends everyone else to sign in. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
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
