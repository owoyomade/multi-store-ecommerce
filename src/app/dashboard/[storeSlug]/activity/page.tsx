import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import { Pagination } from "@/components/pagination";
import { pageParam } from "@/lib/search-params";
import { requireStoreContext } from "@/server/auth/session";
import { roleHasPermission } from "@/server/permissions/roles";
import { listActivity } from "@/server/services/reports";

export const metadata: Metadata = { title: "Activity" };

// Plain-English descriptions of audit actions. Anything not listed falls back
// to the raw action name, so a new action still shows up rather than vanishing.
const ACTION_LABELS: Record<string, string> = {
  "store.created": "Created the store",
  "store.branding_updated": "Changed store branding",
  "store.published": "Published the store",
  "store.unpublished": "Unpublished the store",
  "store.storefront_content_updated": "Edited the homepage",
  "product.created": "Created a product",
  "product.updated": "Edited a product",
  "product.variants_updated": "Edited prices or stock",
  "inventory.adjusted": "Adjusted stock",
  "order.refunded": "Refunded an order",
  "order.cancelled": "Cancelled an order",
  "discount.created": "Created a discount code",
  "discount.paused": "Paused a discount code",
  "discount.activated": "Activated a discount code",
  "staff.invited": "Invited a team member",
  "staff.invite_revoked": "Cancelled an invitation",
  "staff.joined": "Joined the team",
  "staff.role_changed": "Changed a team member's role",
  "staff.removed": "Removed a team member",
};

function describe(entry: { action: string; metadata: unknown }): string {
  // Status changes say which status, e.g. "Marked an order shipped".
  if (
    entry.action === "order.status_changed" &&
    entry.metadata &&
    typeof entry.metadata === "object"
  ) {
    const to = (entry.metadata as { to?: unknown }).to;
    if (typeof to === "string") return `Marked an order ${to.toLowerCase()}`;
  }
  return ACTION_LABELS[entry.action] ?? entry.action;
}

export default async function ActivityPage({
  params,
  searchParams,
}: PageProps<"/dashboard/[storeSlug]/activity">) {
  const { storeSlug } = await params;
  const query = await searchParams;
  const context = await requireStoreContext(storeSlug);
  if (!roleHasPermission(context.role, "reports:view")) {
    return (
      <NoAccess title="Activity" message="Your role doesn't include reports." />
    );
  }
  const page = pageParam(query.page);
  const { entries, names, pageCount } = await listActivity(context, page);
  const base = `/dashboard/${storeSlug}`;

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Activity</h1>
        <p className="mt-1 text-sm text-stone-600">
          A permanent record of changes made in this store and who made them.
        </p>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-600">
          Nothing recorded yet.
        </p>
      ) : (
        <ol className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white text-sm">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3"
            >
              <time className="w-40 shrink-0 text-stone-500">
                {entry.createdAt.toLocaleString("en-CA")}
              </time>
              <span className="font-medium">
                {entry.actorUserId
                  ? (names[entry.actorUserId] ?? "Former team member")
                  : "System"}
              </span>
              <span>
                {entry.entityType === "order" ? (
                  <Link
                    href={`${base}/orders/${entry.entityId}`}
                    className="underline"
                  >
                    {describe(entry)}
                  </Link>
                ) : (
                  describe(entry)
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      <Pagination
        page={page}
        pageCount={pageCount}
        hrefForPage={(next) => `${base}/activity?page=${next}`}
      />
    </div>
  );
}
