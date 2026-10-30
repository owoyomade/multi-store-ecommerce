import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { FieldConflictError, RuleViolationError } from "@/server/errors";
import {
  createStore,
  getStoreDetails,
  listStoresForUser,
  setStorePublished,
  updateStoreBranding,
} from "@/server/services/stores";
import {
  ForbiddenError,
  getStoreContextForUser,
} from "@/server/tenancy/store-context";
import {
  addMember,
  createUser,
  resetDatabase,
  storeInput,
} from "../support/factories";

beforeEach(resetDatabase);

describe("createStore", () => {
  it("makes the creator the owner and writes settings and an audit entry", async () => {
    const alice = await createUser("Alice");
    const store = await createStore(
      alice.id,
      storeInput({ slug: "alice-shop" }),
    );

    const membership = await db.storeMembership.findUniqueOrThrow({
      where: { storeId_userId: { storeId: store.id, userId: alice.id } },
    });
    expect(membership.role).toBe("OWNER");
    expect(await db.storeSettings.count({ where: { storeId: store.id } })).toBe(
      1,
    );
    expect(
      await db.auditLog.count({
        where: { storeId: store.id, action: "store.created" },
      }),
    ).toBe(1);
  });

  it("refuses a slug that another store already uses", async () => {
    const alice = await createUser("Alice");
    const bob = await createUser("Bob");
    await createStore(alice.id, storeInput({ slug: "taken" }));

    await expect(
      createStore(bob.id, storeInput({ slug: "taken" })),
    ).rejects.toBeInstanceOf(FieldConflictError);
  });
});

describe("tenant isolation", () => {
  async function twoStores() {
    const alice = await createUser("Alice");
    const bob = await createUser("Bob");
    const storeA = await createStore(
      alice.id,
      storeInput({ name: "Store A", slug: "store-a" }),
    );
    const storeB = await createStore(
      bob.id,
      storeInput({ name: "Store B", slug: "store-b" }),
    );
    return { alice, bob, storeA, storeB };
  }

  it("gives no context to a user who is not a member of the store", async () => {
    const { alice } = await twoStores();
    expect(await getStoreContextForUser(alice.id, "store-b")).toBeNull();
  });

  it("only lists the stores a user belongs to", async () => {
    const { alice } = await twoStores();
    const stores = await listStoresForUser(alice.id);
    expect(stores.map((store) => store.slug)).toEqual(["store-a"]);
  });

  it("supports one user with different roles in different stores", async () => {
    const { storeA, storeB } = await twoStores();
    const sam = await createUser("Sam");
    await addMember(storeA.id, sam.id, "MANAGER");
    await addMember(storeB.id, sam.id, "FULFILLMENT_AGENT");

    expect((await getStoreContextForUser(sam.id, "store-a"))?.role).toBe(
      "MANAGER",
    );
    expect((await getStoreContextForUser(sam.id, "store-b"))?.role).toBe(
      "FULFILLMENT_AGENT",
    );
  });

  it("updates only the store in the caller's context", async () => {
    const { alice } = await twoStores();
    const context = await getStoreContextForUser(alice.id, "store-a");
    if (!context) throw new Error("expected Alice to be a member of store-a");

    await updateStoreBranding(context, {
      name: "Renamed A",
      contactEmail: "a@example.test",
      primaryColor: "#000000",
      accentColor: "#ffffff",
    });

    const names = await db.store.findMany({
      select: { slug: true, name: true },
      orderBy: { slug: "asc" },
    });
    expect(names).toEqual([
      { slug: "store-a", name: "Renamed A" },
      { slug: "store-b", name: "Store B" },
    ]);
  });

  it("blocks staff whose role lacks the permission", async () => {
    const { storeA } = await twoStores();
    const agent = await createUser("Agent");
    await addMember(storeA.id, agent.id, "FULFILLMENT_AGENT");
    const context = await getStoreContextForUser(agent.id, "store-a");
    if (!context) throw new Error("expected agent to be a member of store-a");

    await expect(
      updateStoreBranding(context, {
        name: "Hijacked",
        contactEmail: "x@example.test",
        primaryColor: "#000000",
        accentColor: "#ffffff",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    // Viewing is still allowed.
    await expect(getStoreDetails(context)).resolves.toMatchObject({
      slug: "store-a",
    });
  });

  it("hides soft-deleted stores from their own members", async () => {
    const { alice, storeA } = await twoStores();
    await db.store.update({
      where: { id: storeA.id },
      data: { deletedAt: new Date() },
    });

    expect(await getStoreContextForUser(alice.id, "store-a")).toBeNull();
    expect(await listStoresForUser(alice.id)).toEqual([]);
  });
});

describe("setStorePublished", () => {
  it("lets the owner publish and unpublish, with audit entries", async () => {
    const alice = await createUser("Alice");
    await createStore(alice.id, storeInput({ slug: "shop" }));
    const context = await getStoreContextForUser(alice.id, "shop");
    if (!context) throw new Error("expected membership");

    await setStorePublished(context, true);
    expect(
      (await db.store.findUniqueOrThrow({ where: { slug: "shop" } })).status,
    ).toBe("ACTIVE");
    await setStorePublished(context, false);
    expect(
      (await db.store.findUniqueOrThrow({ where: { slug: "shop" } })).status,
    ).toBe("DRAFT");
    expect(
      await db.auditLog.count({
        where: { action: { in: ["store.published", "store.unpublished"] } },
      }),
    ).toBe(2);
  });

  it("can't bring back a store the platform suspended", async () => {
    const alice = await createUser("Alice");
    const store = await createStore(alice.id, storeInput({ slug: "shop" }));
    await db.store.update({
      where: { id: store.id },
      data: { status: "SUSPENDED" },
    });
    const context = await getStoreContextForUser(alice.id, "shop");
    if (!context) throw new Error("expected membership");

    await expect(setStorePublished(context, true)).rejects.toBeInstanceOf(
      RuleViolationError,
    );
  });

  it("is refused for managers", async () => {
    const alice = await createUser("Alice");
    const store = await createStore(alice.id, storeInput({ slug: "shop" }));
    const manager = await createUser("Manager");
    await addMember(store.id, manager.id, "MANAGER");
    const context = await getStoreContextForUser(manager.id, "shop");
    if (!context) throw new Error("expected membership");

    await expect(setStorePublished(context, true)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });
});
