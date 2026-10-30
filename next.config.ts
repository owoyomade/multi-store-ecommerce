import type { NextConfig } from "next";

// Cache Components is turned off on purpose. Almost every page in this app
// depends on who is signed in or which store is being viewed, so the classic
// "pages that read cookies are rendered per request" model is simpler to
// reason about. We can opt individual storefront pages into caching later.
const nextConfig: NextConfig = {
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
