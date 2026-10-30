import "server-only";
import { Prisma } from "@/generated/prisma/client";
import {
  createStoreSchema,
  updateStoreBrandingSchema,
  type CreateStoreInput,
  type UpdateStoreBrandingInput,
} from "@/lib/validation/store";
import { db } from "../db";
import { FieldConflictError, RuleViolationError } from "../errors";
import { requirePermission, type StoreContext } from "../tenancy/store-context";
import { recordAudit } from "./audit";

/**
 * Creates a store and makes the creator its Owner. Store, settings, membership,
 * default stock location and audit entry are written in one transaction so a failure never leaves a
 * store without an owner.
 */
export async function createStore(userId: string, input: CreateStoreInput) {
  const data = createStoreSchema.parse(input);

  try {
    return await db.$transaction(async (tx) => {
      const store = await tx.store.create({
        data: {
          ...data,
          settings: { create: {} },
          memberships: { create: { userId, role: "OWNER" } },
          inventoryLocations: {
            create: { name: "Main warehouse", isDefault: true },
          },
        },
        select: { id: true, slug: true },
      });
      await recordAudit(tx, {
        storeId: store.id,
        actorUserId: userId,
        action: "store.created",
        entityType: "store",
        entityId: store.id,
      });
      return store;
    });
  } catch (error) {
    // P2002 is Prisma's "unique constraint failed"; the only unique field here is the slug.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new FieldConflictError(
        "slug",
        "That store address is already taken",
      );
    }
    throw error;
  }
}

/** Stores the user belongs to, for the store switcher. */
export async function listStoresForUser(userId: string) {
  const memberships = await db.storeMembership.findMany({
    where: { userId, store: { deletedAt: null } },
    select: {
      role: true,
      store: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          primaryColor: true,
        },
      },
    },
    orderBy: { store: { name: "asc" } },
  });
  return memberships.map(({ role, store }) => ({ ...store, role }));
}

export async function getStoreDetails(context: StoreContext) {
  requirePermission(context, "store:view");
  return db.store.findUniqueOrThrow({
    where: { id: context.storeId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      currency: true,
      country: true,
      contactEmail: true,
      primaryColor: true,
      accentColor: true,
      theme: true,
      tagline: true,
      createdAt: true,
      _count: {
        select: { memberships: true, products: { where: { deletedAt: null } } },
      },
    },
  });
}

export async function updateStoreBranding(
  context: StoreContext,
  input: UpdateStoreBrandingInput,
) {
  requirePermission(context, "store:settings");
  const data = updateStoreBrandingSchema.parse(input);

  return db.$transaction(async (tx) => {
    // The `where` uses the store ID from the server-built context, so this
    // can only ever update the store the user is a member of.
    const store = await tx.store.update({
      where: { id: context.storeId },
      data,
      select: { id: true },
    });
    await recordAudit(tx, {
      storeId: context.storeId,
      actorUserId: context.userId,
      action: "store.branding_updated",
      entityType: "store",
      entityId: store.id,
      metadata: { fields: Object.keys(data) },
    });
    return store;
  });
}

/**
 * Publishes (ACTIVE) or unpublishes (DRAFT) a store. A store suspended by the
 * platform can't be republished by its owner.
 */
export async function setStorePublished(
  context: StoreContext,
  published: boolean,
) {
  requirePermission(context, "store:settings");
  const status = published ? "ACTIVE" : "DRAFT";

  await db.$transaction(async (tx) => {
    const { count } = await tx.store.updateMany({
      where: { id: context.storeId, status: { not: "SUSPENDED" } },
      data: { status },
    });
    if (count === 0)
      throw new RuleViolationError(
        "This store is suspended. Contact support to restore it.",
      );
    await recordAudit(tx, {
      storeId: context.storeId,
      actorUserId: context.userId,
      action: published ? "store.published" : "store.unpublished",
      entityType: "store",
      entityId: context.storeId,
    });
  });
}
