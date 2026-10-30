import { NextResponse, type NextRequest } from "next/server";

// Lets each store be reached on its own subdomain, e.g.
// northbrew.localhost:3210/products → /s/northbrew/products.
//
// The proxy only rewrites URLs. It doesn't check permissions; the storefront
// pages still load the store and decide whether it may be shown.

const SUBDOMAIN_HEADER = "x-storefront-subdomain";
const appHost = new URL(process.env.APP_URL ?? "http://localhost:3210").host;
const NOT_STORES = new Set(["www", "app", "admin", "api"]);
// Paths shared by every host: auth, images, health checks and Next's own assets.
const SHARED_PATH = /^\/(api|media|_next)(\/|$)/;

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

  const storeSlug = storeSlugFromHost(request.headers.get("host"));
  const { pathname } = request.nextUrl;

  if (!storeSlug || SHARED_PATH.test(pathname)) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  requestHeaders.set(SUBDOMAIN_HEADER, storeSlug);
  const url = request.nextUrl.clone();
  url.pathname = `/s/${storeSlug}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  // Skip static files and image optimisation so they load without extra work.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
