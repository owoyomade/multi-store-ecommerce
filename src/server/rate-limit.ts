import "server-only";
import { headers } from "next/headers";
import { db } from "./db";
import { RuleViolationError } from "./errors";

/** Thrown when a key has used up its allowance. Forms show it like any rule error. */
export class RateLimitedError extends RuleViolationError {
  constructor(
    message = "Too many attempts. Please wait a minute and try again.",
  ) {
    super(message);
    this.name = "RateLimitedError";
  }
}

export type RateLimitRule = {
  limit: number;
  windowSeconds: number;
  message?: string;
};

/**
 * Counts one request against `key` and throws once more than `limit` requests
 * arrive within the window. The counter is a single atomic INSERT ... ON
 * CONFLICT, so simultaneous requests can't all slip under the limit.
 */
export async function consumeRateLimit(
  key: string,
  rule: RateLimitRule,
): Promise<void> {
  const [bucket] = await db.$queryRaw<{ count: number }[]>`
    INSERT INTO "rate_limit_buckets" ("key", "count", "windowStartedAt")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "rate_limit_buckets"."windowStartedAt" <= now() - make_interval(secs => ${rule.windowSeconds})
        THEN 1 ELSE "rate_limit_buckets"."count" + 1 END,
      "windowStartedAt" = CASE
        WHEN "rate_limit_buckets"."windowStartedAt" <= now() - make_interval(secs => ${rule.windowSeconds})
        THEN now() ELSE "rate_limit_buckets"."windowStartedAt" END
    RETURNING "count"`;

  // Old buckets are useless once their window has passed. Clearing them now
  // and then keeps the table small without a separate cleanup job.
  if (Math.random() < 0.01) {
    await db.$executeRaw`DELETE FROM "rate_limit_buckets" WHERE "windowStartedAt" < now() - interval '1 day'`;
  }

  if (bucket.count > rule.limit) throw new RateLimitedError(rule.message);
}

/**
 * The visitor's IP address as reported by the hosting platform's proxy.
 * Locally there's no proxy, so everyone shares the "unknown" bucket.
 */
export async function clientIp(): Promise<string> {
  const requestHeaders = await headers();
  const forwarded = requestHeaders
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  return forwarded || requestHeaders.get("x-real-ip") || "unknown";
}

// One place to see and tune every limit in the app.
export const RATE_LIMITS = {
  checkout: { limit: 10, windowSeconds: 60 },
  discountCode: {
    limit: 15,
    windowSeconds: 600,
    message: "Too many discount codes tried. Please wait a few minutes.",
  },
  staffInvite: {
    limit: 20,
    windowSeconds: 3600,
    message: "Too many invitations sent. Try again in an hour.",
  },
  ordersExport: { limit: 10, windowSeconds: 60 },
} satisfies Record<string, RateLimitRule>;
