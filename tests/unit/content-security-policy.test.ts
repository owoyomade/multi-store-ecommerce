import { describe, expect, it } from "vitest";
import { buildContentSecurityPolicy } from "@/lib/content-security-policy";

describe("buildContentSecurityPolicy", () => {
  it("only runs scripts carrying this request's nonce", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "abc123",
      isDev: false,
      upgradeInsecureRequests: true,
    });
    expect(policy).toContain(
      "script-src 'self' 'nonce-abc123' 'strict-dynamic'",
    );
    expect(policy).not.toContain("unsafe-eval");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("upgrade-insecure-requests");
  });

  it("allows eval in development and plain http when the site isn't on HTTPS", () => {
    const policy = buildContentSecurityPolicy({
      nonce: "abc123",
      isDev: true,
      upgradeInsecureRequests: false,
    });
    expect(policy).toContain("'unsafe-eval'");
    expect(policy).not.toContain("upgrade-insecure-requests");
  });
});
