import { describe, expect, it } from "vitest";
import {
  createStoreSchema,
  storeSlugSchema,
  suggestSlug,
} from "@/lib/validation/store";

describe("storeSlugSchema", () => {
  it("accepts lowercase words joined by hyphens", () => {
    expect(storeSlugSchema.parse("northbrew-coffee")).toBe("northbrew-coffee");
  });

  it("normalises case and whitespace", () => {
    expect(storeSlugSchema.parse("  Northbrew ")).toBe("northbrew");
  });

  it.each([
    "ab",
    "has space",
    "double--hyphen",
    "-leading",
    "emoji☕",
    "admin",
    "dashboard",
  ])("rejects %s", (slug) => {
    expect(storeSlugSchema.safeParse(slug).success).toBe(false);
  });
});

describe("suggestSlug", () => {
  it("builds a URL-safe slug from a store name", () => {
    expect(suggestSlug("Café Lumière & Co.")).toBe("cafe-lumiere-co");
  });
});

describe("createStoreSchema", () => {
  it("rejects unsupported currencies and bad colours", () => {
    const result = createStoreSchema.safeParse({
      name: "Shop",
      slug: "shop",
      currency: "XYZ",
      country: "CA",
      contactEmail: "a@example.test",
      primaryColor: "red",
      accentColor: "#ffffff",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      "currency",
      "primaryColor",
    ]);
  });
});
