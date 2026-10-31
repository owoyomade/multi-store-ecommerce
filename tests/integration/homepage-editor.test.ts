import sharp from "sharp";
import { beforeEach, describe, expect, it } from "vitest";
import { FieldConflictError, RuleViolationError } from "@/server/errors";
import { createProduct } from "@/server/services/catalog";
import {
  getStorefrontContent,
  listFeaturableProducts,
  removeHomepagePicture,
  setHomepagePicture,
  updateHomepageText,
} from "@/server/services/storefront-content";
import { createStore } from "@/server/services/stores";
import { storage } from "@/server/storage/storage";
import { ForbiddenError } from "@/server/tenancy/store-context";
import {
  addMember,
  contextFor,
  createUser,
  productInput,
  resetDatabase,
  storeInput,
} from "../support/factories";

beforeEach(resetDatabase);

const png = (colour = "#336699") =>
  sharp({ create: { width: 40, height: 30, channels: 3, background: colour } })
    .png()
    .toBuffer();

async function owner() {
  const alice = await createUser("Alice");
  const store = await createStore(alice.id, storeInput({ slug: "shop" }));
  return { store, context: await contextFor(alice.id, "shop") };
}

const letterText = {
  letterText: "First paragraph.\n\nSecond paragraph.",
  letterSignedBy: "Alice Owner",
  letterRole: "Founder",
};

describe("homepage pictures", () => {
  it("replaces a picture and deletes the old file", async () => {
    const { context } = await owner();
    await setHomepagePicture(context, "hero", {
      bytes: await png(),
      alt: "First",
    });
    const first = (await getStorefrontContent(context)).heroImage;

    await setHomepagePicture(context, "hero", {
      bytes: await png("#993366"),
      alt: "Second",
    });
    const second = (await getStorefrontContent(context)).heroImage;

    expect(second?.storageKey).not.toBe(first?.storageKey);
    expect(await storage.get(first?.storageKey ?? "")).toBeNull();
    expect(await storage.get(second?.storageKey ?? "")).not.toBeNull();
  });

  it("updates alt text, caption and credit without a new upload", async () => {
    const { context } = await owner();
    await setHomepagePicture(context, "footer", {
      bytes: await png(),
      alt: "Street",
    });
    const before = (await getStorefrontContent(context)).footerImage;

    await setHomepagePicture(context, "footer", {
      bytes: null,
      alt: "Our street in 1905",
      credit: "Public domain",
    });

    const after = (await getStorefrontContent(context)).footerImage;
    expect(after).toMatchObject({
      storageKey: before?.storageKey,
      alt: "Our street in 1905",
      credit: "Public domain",
    });
  });

  it("requires alt text and a file for an empty slot", async () => {
    const { context } = await owner();
    await expect(
      setHomepagePicture(context, "hero", { bytes: await png(), alt: "  " }),
    ).rejects.toThrow();
    await expect(
      setHomepagePicture(context, "hero", {
        bytes: null,
        alt: "Nothing uploaded",
      }),
    ).rejects.toBeInstanceOf(RuleViolationError);
  });

  it("removes a picture and its file", async () => {
    const { context } = await owner();
    await setHomepagePicture(context, "plate-1", {
      bytes: await png(),
      alt: "Plate",
    });
    const plate = (await getStorefrontContent(context)).plates[0];

    await removeHomepagePicture(context, "plate-1");

    expect((await getStorefrontContent(context)).plates).toEqual([]);
    expect(await storage.get(plate?.storageKey ?? "")).toBeNull();
  });

  it("only accepts a letter picture once there is a letter", async () => {
    const { context } = await owner();
    await expect(
      setHomepagePicture(context, "letter", { bytes: await png(), alt: "Me" }),
    ).rejects.toBeInstanceOf(RuleViolationError);
    await updateHomepageText(context, letterText);
    await expect(
      setHomepagePicture(context, "letter", { bytes: await png(), alt: "Me" }),
    ).resolves.toBeUndefined();
  });
});

describe("homepage words", () => {
  it("saves the words and keeps the pictures", async () => {
    const { context } = await owner();
    await setHomepagePicture(context, "hero", {
      bytes: await png(),
      alt: "Hero",
    });

    await updateHomepageText(context, {
      summary: "Small-batch coffee.",
      actionLabel: "",
      facts: ["Roasted in Toronto", "", "Free shipping over $75"],
      ...letterText,
    });

    const content = await getStorefrontContent(context);
    expect(content).toMatchObject({
      summary: "Small-batch coffee.",
      actionLabel: "Shop now",
      facts: ["Roasted in Toronto", "Free shipping over $75"],
      letter: {
        paragraphs: ["First paragraph.", "Second paragraph."],
        signedBy: "Alice Owner",
      },
    });
    expect(content.heroImage?.alt).toBe("Hero");
  });

  it("removes the letter's picture when the letter is cleared", async () => {
    const { context } = await owner();
    await updateHomepageText(context, letterText);
    await setHomepagePicture(context, "letter", {
      bytes: await png(),
      alt: "Me",
    });
    const picture = (await getStorefrontContent(context)).letter?.image;

    await updateHomepageText(context, { letterText: "" });

    expect((await getStorefrontContent(context)).letter).toBeUndefined();
    expect(await storage.get(picture?.storageKey ?? "")).toBeNull();
  });

  it("needs a signature for the letter", async () => {
    const { context } = await owner();
    await expect(
      updateHomepageText(context, { letterText: "Hello." }),
    ).rejects.toThrow();
  });

  it("only features this store's published products", async () => {
    const { context } = await owner();
    await createProduct(
      context,
      productInput({ title: "Mug", slug: "mug", skuPrefix: "MUG" }),
    );
    await createProduct(
      context,
      productInput({
        title: "Secret",
        slug: "secret",
        skuPrefix: "SECRET",
        status: "DRAFT",
      }),
    );

    expect(
      (await listFeaturableProducts(context)).map((product) => product.slug),
    ).toEqual(["mug"]);
    await expect(
      updateHomepageText(context, { featuredProductSlug: "secret" }),
    ).rejects.toBeInstanceOf(FieldConflictError);
    await updateHomepageText(context, { featuredProductSlug: "mug" });
    expect((await getStorefrontContent(context)).featuredProductSlug).toBe(
      "mug",
    );
  });

  it("can't be edited by a manager", async () => {
    const { store } = await owner();
    const manager = await createUser("Manager");
    await addMember(store.id, manager.id, "MANAGER");
    const managerContext = await contextFor(manager.id, "shop");

    await expect(
      updateHomepageText(managerContext, { summary: "Hacked" }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      setHomepagePicture(managerContext, "hero", {
        bytes: await png(),
        alt: "Hacked",
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
    await expect(
      removeHomepagePicture(managerContext, "hero"),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});
