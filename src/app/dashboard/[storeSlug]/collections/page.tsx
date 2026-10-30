import type { Metadata } from "next";
import { NoAccess } from "@/components/no-access";
import { requireStoreContext } from "@/server/auth/session";
import { roleHasPermission } from "@/server/permissions/roles";
import { listCollections } from "@/server/services/catalog";
import { deleteCollectionAction } from "./actions";
import { CollectionForm } from "./collection-form";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage({
  params,
}: PageProps<"/dashboard/[storeSlug]/collections">) {
  const { storeSlug } = await params;
  const context = await requireStoreContext(storeSlug);
  if (!roleHasPermission(context.role, "catalog:edit")) {
    return (
      <NoAccess
        title="Collections"
        message="Your role doesn't include managing products."
      />
    );
  }
  const collections = await listCollections(context);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Collections</h1>
        <p className="mt-1 text-sm text-stone-600">
          Group products so shoppers can browse them, e.g. “New arrivals” or
          “Gifts under $30”. Add products to a collection from the
          product&apos;s page.
        </p>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-4 font-semibold">New collection</h2>
        {/* Re-keying on the count remounts the form after a create, clearing its inputs. */}
        <CollectionForm key={collections.length} storeSlug={storeSlug} />
      </section>

      {collections.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-600">
          No collections yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {collections.map((collection) => (
            <li
              key={collection.id}
              className="rounded-xl border border-stone-200 bg-white p-5"
            >
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{collection.title}</span>
                  <span className="text-sm text-stone-500">
                    {collection._count.products} product
                    {collection._count.products === 1 ? "" : "s"} · Edit
                  </span>
                </summary>
                <div className="mt-4 space-y-4">
                  <CollectionForm
                    storeSlug={storeSlug}
                    collection={collection}
                  />
                  <form
                    action={deleteCollectionAction.bind(
                      null,
                      storeSlug,
                      collection.id,
                    )}
                  >
                    <button
                      type="submit"
                      className="text-sm text-red-700 underline"
                    >
                      Delete collection (products are kept)
                    </button>
                  </form>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
