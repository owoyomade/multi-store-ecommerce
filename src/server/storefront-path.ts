import "server-only";
import { headers } from "next/headers";

/**
 * Storefronts are reachable two ways: /s/northbrew/... and, via the proxy,
 * northbrew.localhost:3210/... This returns the prefix links should use so
 * they work in whichever form the shopper arrived.
 */
export async function storefrontBasePath(storeSlug: string): Promise<string> {
  const requestHeaders = await headers();
  return requestHeaders.get("x-storefront-subdomain") === storeSlug
    ? ""
    : `/s/${storeSlug}`;
}
