import type { MetadataRoute } from "next";

// Tells search engines to index storefronts but stay out of private areas.
// This is a courtesy, not security: those pages check permissions themselves.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/api",
        "/invite",
        "/two-factor",
        "/s/*/cart",
        "/s/*/checkout",
        "/s/*/account",
      ],
    },
  };
}
