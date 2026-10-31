import { describe, expect, it } from "vitest";
import { redactPath } from "@/server/observability";

describe("redactPath", () => {
  it("drops query strings, which can carry tokens or emails", () => {
    expect(redactPath("/s/shop/checkout?discount=SAVE10")).toBe(
      "/s/shop/checkout",
    );
  });

  it("hides invite and password-reset tokens", () => {
    expect(redactPath("/invite/abc123secret")).toBe("/invite/[token]");
    expect(redactPath("/reset-password/xyz")).toBe("/reset-password/[token]");
  });
});
