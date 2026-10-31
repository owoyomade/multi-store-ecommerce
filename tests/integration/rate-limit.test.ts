import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/server/db";
import { consumeRateLimit, RateLimitedError } from "@/server/rate-limit";
import { resetDatabase } from "../support/factories";

beforeEach(resetDatabase);

const rule = { limit: 3, windowSeconds: 60 };

describe("consumeRateLimit", () => {
  it("allows requests up to the limit, then refuses", async () => {
    for (let attempt = 0; attempt < 3; attempt++)
      await consumeRateLimit("test:a", rule);
    await expect(consumeRateLimit("test:a", rule)).rejects.toThrow(
      RateLimitedError,
    );
  });

  it("counts each key separately", async () => {
    for (let attempt = 0; attempt < 3; attempt++)
      await consumeRateLimit("test:a", rule);
    await expect(consumeRateLimit("test:b", rule)).resolves.toBeUndefined();
  });

  it("starts a fresh window once the old one has passed", async () => {
    for (let attempt = 0; attempt < 3; attempt++)
      await consumeRateLimit("test:a", rule);
    await db.rateLimitBucket.update({
      where: { key: "test:a" },
      data: { windowStartedAt: new Date(Date.now() - 61_000) },
    });
    await expect(consumeRateLimit("test:a", rule)).resolves.toBeUndefined();
  });

  it("holds under simultaneous requests", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => consumeRateLimit("test:burst", rule)),
    );
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(3);
  });
});
