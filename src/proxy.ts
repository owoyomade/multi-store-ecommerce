import { NextResponse, type NextRequest } from "next/server";
import { buildContentSecurityPolicy } from "@/lib/content-security-policy";

// Lets each store be reached on its own subdomain, e.g.
// northbrew.localhost:3210/products → /s/northbrew/products.
//
// The proxy only rewrites URLs. It doesn't check permissions; the storefront
// pages still load the store and decide whether it may be shown.

const SUBDOMAIN_HEADER = "x-storefront-subdomain";
const appHost = new URL(process.env.APP_URL ?? "http://localhost:3210").host;
const NOT_STORES = new Set(["www", "app", "admin", "api"]);
// Paths shared by every host: auth, images, health checks, robots.txt and
// Next's own assets.
const SHARED_PATH = /^\/(api|media|_next|robots\.txt)(\/|$)/;

function storeSlugFromHost(host: string | null): string | null {
  if (!host?.endsWith(`.${appHost}`)) return null;
  const subdomain = host.slice(0, -(appHost.length + 1));
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(subdomain) || NOT_STORES.has(subdomain))
    return null;
  return subdomain;
}

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  // Never trust this header from the outside world; only the proxy sets it.
  requestHeaders.delete(SUBDOMAIN_HEADER);

  // A fresh random nonce per request. Next reads the policy from the request
  // headers and stamps the nonce onto the scripts it renders.
  const contentSecurityPolicy = buildContentSecurityPolicy({
    nonce: Buffer.from(crypto.randomUUID()).toString("base64"),
    isDev: process.env.NODE_ENV === "development",
    upgradeInsecureRequests:
      process.env.APP_URL?.startsWith("https://") ?? false,
  });
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const storeSlug = storeSlugFromHost(request.headers.get("host"));
  const { pathname } = request.nextUrl;

  let response: NextResponse;
  if (!storeSlug || SHARED_PATH.test(pathname)) {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    requestHeaders.set(SUBDOMAIN_HEADER, storeSlug);
    const url = request.nextUrl.clone();
    url.pathname = `/s/${storeSlug}${pathname === "/" ? "" : pathname}`;
    response = NextResponse.rewrite(url, {
      request: { headers: requestHeaders },
    });
  }
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  // Skip static files and image optimisation so they load without extra work.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
