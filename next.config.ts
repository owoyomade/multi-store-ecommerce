import type { NextConfig } from "next";

// Cache Components is turned off on purpose. Almost every page in this app
// depends on who is signed in or which store is being viewed, so the classic
// "pages that read cookies are rendered per request" model is simpler to
// reason about. We can opt individual storefront pages into caching later.
const nextConfig: NextConfig = {
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
