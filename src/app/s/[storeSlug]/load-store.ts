import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getCurrentUser } from "@/server/auth/session";
import { getVisibleStore } from "@/server/services/storefront";

/**
 * The store for the current storefront request, or a 404. Wrapped in React's
 * cache() so the layout and page share one lookup per request.
 */
export const loadStorefront = cache(async (storeSlug: string) => {
  const viewer = await getCurrentUser();
  const store = await getVisibleStore(storeSlug, viewer?.id ?? null);
  if (!store) notFound();
  return store;
});
