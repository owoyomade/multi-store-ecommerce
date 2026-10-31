import { BoldHome } from "@/components/storefront/bold/bold-home";
import { ClassicHome } from "@/components/storefront/classic/classic-home";
import { storefrontBasePath } from "@/server/storefront-path";
import { loadStorefront } from "./load-store";

// Each theme composes its own homepage from the same store data.
export default async function StorefrontHomePage({
  params,
}: PageProps<"/s/[storeSlug]">) {
  const { storeSlug } = await params;
  const [store, base] = await Promise.all([
    loadStorefront(storeSlug),
    storefrontBasePath(storeSlug),
  ]);

  return store.theme === "BOLD" ? (
    <BoldHome store={store} base={base} />
  ) : (
    <ClassicHome store={store} base={base} />
  );
}
