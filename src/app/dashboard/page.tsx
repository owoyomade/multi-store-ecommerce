import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { ROLE_LABELS } from "@/server/permissions/roles";
import { requireUser } from "@/server/auth/session";
import { listStoresForUser } from "@/server/services/stores";
import { StoreStatusBadge } from "./store-status-badge";

export const metadata: Metadata = { title: "Your stores" };

export default async function DashboardHomePage() {
  const user = await requireUser();
  const stores = await listStoresForUser(user.id);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Your stores</h1>
        <Link href="/dashboard/new" className={buttonClasses()}>
          New store
        </Link>
      </div>

      {stores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <h2 className="font-medium">You don&apos;t have a store yet</h2>
          <p className="mt-1 text-sm text-stone-600">
            Create one to start adding products.
          </p>
          <Link href="/dashboard/new" className={`${buttonClasses()} mt-4`}>
            Create your first store
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {stores.map((store) => (
            <li key={store.id}>
              <Link
                href={`/dashboard/${store.slug}`}
                className="flex items-center gap-4 px-4 py-4 hover:bg-stone-50"
              >
                <span
                  aria-hidden
                  className="size-8 shrink-0 rounded-md"
                  style={{ backgroundColor: store.primaryColor }}
                />
                <span className="flex-1">
                  <span className="block font-medium">{store.name}</span>
                  <span className="block text-sm text-stone-500">
                    {ROLE_LABELS[store.role]}
                  </span>
                </span>
                <StoreStatusBadge status={store.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
