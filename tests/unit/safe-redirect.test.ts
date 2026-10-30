import { describe, expect, it } from "vitest";
import { safeNextPath } from "@/lib/safe-redirect";

describe("safeNextPath", () => {
  it("keeps paths on this site", () => {
    expect(safeNextPath("/s/northbrew/account")).toBe("/s/northbrew/account");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "",
    null,
  ])("falls back for %s", (next) => {
    expect(safeNextPath(next)).toBe("/dashboard");
  });
});
