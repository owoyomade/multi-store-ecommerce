import "server-only";
import type { StoreRole } from "@/generated/prisma/enums";
import { db } from "../db";
import { roleHasPermission, type Permission } from "../permissions/roles";

/**
 * Who is acting, in which store, with which role.
 *
 * Every service function that touches store data takes this as its first
 * argument and filters queries by `storeId`. It is only ever built on the
 * server from the signed-in user's membership, never from browser input.
 */
export type StoreContext = {
  storeId: string;
  storeSlug: string;
  userId: string;
  role: StoreRole;
};

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Missing permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

/**
 * Returns the user's context for a store, or null when they are not a member
 * (or the store is deleted). Callers treat null as "not found" so that
 * non-members cannot even learn whether a store slug exists in the dashboard.
 */
export async function getStoreContextForUser(
  userId: string,
  storeSlug: string,
): Promise<StoreContext | null> {
  const membership = await db.storeMembership.findFirst({
    where: { userId, store: { slug: storeSlug, deletedAt: null } },
    select: { role: true, store: { select: { id: true, slug: true } } },
  });
  if (!membership) return null;

  return {
    storeId: membership.store.id,
    storeSlug: membership.store.slug,
    userId,
    role: membership.role,
  };
}

export function requirePermission(
  context: StoreContext,
  permission: Permission,
): void {
  if (!roleHasPermission(context.role, permission)) {
    throw new ForbiddenError(permission);
  }
}
