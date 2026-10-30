import { describe, expect, it } from "vitest";
import { createProductSchema } from "@/lib/validation/catalog";
import { combineOptionValues } from "@/server/services/catalog";
import { productInput } from "../support/factories";

describe("combineOptionValues", () => {
  it("builds every combination in a stable order", () => {
    expect(
      combineOptionValues([
        ["S", "M"],
        ["Black", "White"],
      ]),
    ).toEqual([
      ["S", "Black"],
      ["S", "White"],
      ["M", "Black"],
      ["M", "White"],
    ]);
  });
});

describe("createProductSchema", () => {
  it("turns prices into cents and option text into lists", () => {
    const parsed = createProductSchema.parse(
      productInput({
        price: "19.5",
        compareAtPrice: "25",
        option1Name: "Size",
        option1Values: "S, M, , M",
      }),
    );
    expect(parsed.price).toBe(1950);
    expect(parsed.compareAtPrice).toBe(2500);
    expect(parsed.option1Values).toEqual(["S", "M"]);
  });

  it("rejects a compare-at price that isn't higher than the price", () => {
    const result = createProductSchema.safeParse(
      productInput({ price: "20", compareAtPrice: "15" }),
    );
    expect(result.error?.issues[0]?.path).toEqual(["compareAtPrice"]);
  });

  it("requires values for a named option and a name for given values", () => {
    const result = createProductSchema.safeParse(
      productInput({ option1Name: "Size", option2Values: "Red" }),
    );
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      "option1Values",
      "option2Name",
    ]);
  });
});
