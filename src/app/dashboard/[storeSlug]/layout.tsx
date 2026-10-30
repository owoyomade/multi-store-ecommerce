import Link from "next/link";
import { roleHasPermission, ROLE_LABELS } from "@/server/permissions/roles";
import { requireStoreContext } from "@/server/auth/session";
import { getStoreDetails } from "@/server/services/stores";

export default async function StoreDashboardLayout({
  children,
  params,
}: LayoutProps<"/dashboard/[storeSlug]">) {
  const { storeSlug } = await params;
  const context = await requireStoreContext(storeSlug);
  const store = await getStoreDetails(context);

  // Only show links the user's role can actually use. The pages and actions
  // still check permissions themselves; hiding links is just for clarity.
  const navigation = [
    { href: `/dashboard/${store.slug}`, label: "Overview" },
    ...(roleHasPermission(context.role, "store:settings")
      ? [{ href: `/dashboard/${store.slug}/settings`, label: "Settings" }]
      : []),
  ];

  return (
    <div className="flex flex-1 flex-col sm:flex-row">
      <aside className="border-b border-stone-200 bg-white sm:w-56 sm:border-r sm:border-b-0">
        <div className="flex items-center gap-3 px-4 py-4">
          <span
            aria-hidden
            className="size-8 shrink-0 rounded-md"
            style={{ backgroundColor: store.primaryColor }}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{store.name}</p>
            <p className="text-xs text-stone-500">
              {ROLE_LABELS[context.role]}
            </p>
          </div>
        </div>
        <nav aria-label="Store" className="flex gap-1 px-2 pb-3 sm:flex-col">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-stone-700 hover:bg-stone-100"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/dashboard"
            className="rounded-md px-3 py-2 text-sm text-stone-500 hover:bg-stone-100"
          >
            All stores
          </Link>
        </nav>
      </aside>
      <main className="flex-1 px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
