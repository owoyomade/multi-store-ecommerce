import type { NextConfig } from "next";

// Cache Components is turned off on purpose. Almost every page in this app
// depends on who is signed in or which store is being viewed, so the classic
// "pages that read cookies are rendered per request" model is simpler to
// reason about. We can opt individual storefront pages into caching later.
// Security headers sent with every response. The Content-Security-Policy is
// added per request in src/proxy.ts, because it needs a fresh nonce each time.
const securityHeaders = [
  // Browsers must trust our Content-Type instead of guessing (stops a file
  // upload being run as a script).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites only learn our domain, never full URLs such as invite links.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Older browsers that ignore CSP frame-ancestors still refuse framing.
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  // Once a browser has seen the site over HTTPS, it refuses plain HTTP for two
  // years. Only in production: localhost has no HTTPS.
  ...(process.env.NODE_ENV === "production"
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  // Don't advertise the framework in an X-Powered-By header.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    serverActions: {
      // Product images may be up to 5 MB; leave room for the form's own overhead.
      bodySizeLimit: "6mb",
    },
  },
  images: {
    // next/image may only optimise our own uploaded product images.
    localPatterns: [{ pathname: "/media/**", search: "" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
