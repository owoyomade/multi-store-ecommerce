import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { parseStorefrontContent } from "@/lib/validation/storefront-content";
import { RuleViolationError } from "@/server/errors";
import { getVisibleStore } from "@/server/services/storefront";
import {
  getStorefrontContent,
  updateStorefrontContent,
  uploadStorefrontImage,
} from "@/server/services/storefront-content";
import { createStore } from "@/server/services/stores";
import { ForbiddenError } from "@/server/tenancy/store-context";
import {
  addMember,
  contextFor,
  createUser,
  resetDatabase,
  storeInput,
} from "../support/factories";

beforeEach(resetDatabase);

const png = () =>
  sharp({
    create: { width: 40, height: 30, channels: 3, background: "#336699" },
  })
    .png()
    .toBuffer();

async function twoOwners() {
  const alice = await createUser("Alice");
  const bob = await createUser("Bob");
  const storeA = await createStore(alice.id, storeInput({ slug: "store-a" }));
  await createStore(bob.id, storeInput({ slug: "store-b" }));
  return {
    alice,
    storeA,
    contextA: await contextFor(alice.id, "store-a"),
    contextB: await contextFor(bob.id, "store-b"),
  };
}

describe("storefront content", () => {
  it("stores pictures in the store's own folder and saves the content", async () => {
    const { contextA } = await twoOwners();
    const hero = await uploadStorefrontImage(contextA, {
      bytes: await png(),
      alt: "Beans",
      credit: "Public domain",
    });
    expect(hero.storageKey).toMatch(
      new RegExp(`^stores/${contextA.storeId}/content/[a-f0-9-]+\\.webp$`),
    );

    await updateStorefrontContent(contextA, {
      heroImage: hero,
      facts: ["Roasted in Toronto"],
    });

    const content = await getStorefrontContent(contextA);
    expect(content.heroImage?.storageKey).toBe(hero.storageKey);
    expect(content.actionLabel).toBe("Shop now");
  });

  it("refuses to display a picture that belongs to another store", async () => {
    const { contextA, contextB } = await twoOwners();
    const bobsPicture = await uploadStorefrontImage(contextB, {
      bytes: await png(),
      alt: "Bob's picture",
    });

    await expect(
      updateStorefrontContent(contextA, { heroImage: bobsPicture }),
    ).rejects.toBeInstanceOf(RuleViolationError);
  });

  it("only lets roles with settings access change the homepage", async () => {
    const { storeA } = await twoOwners();
    const manager = await createUser("Manager");
    await addMember(storeA.id, manager.id, "MANAGER");
    const managerContext = await contextFor(manager.id, "store-a");

    await expect(
      updateStorefrontContent(managerContext, { facts: ["Hacked"] }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      uploadStorefrontImage(managerContext, { bytes: await png(), alt: "x" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("falls back to empty content when the stored data is malformed", () => {
    expect(parseStorefrontContent({ facts: "not a list" })).toMatchObject({
      facts: [],
      plates: [],
    });
    expect(parseStorefrontContent(null).letter).toBeUndefined();
  });

  it("is returned with the public store", async () => {
    const { contextA } = await twoOwners();
    await updateStorefrontContent(contextA, { summary: "Small-batch coffee." });
    const store = await getVisibleStore("store-a", contextA.userId);
    expect(store?.content.summary).toBe("Small-batch coffee.");
  });
});
