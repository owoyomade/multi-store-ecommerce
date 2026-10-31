import type { Metadata } from "next";
import Link from "next/link";
import { requireStoreContext } from "@/server/auth/session";
import { getPaymentProvider } from "@/server/payments";
import { roleHasPermission } from "@/server/permissions/roles";
import { formatMoney } from "@/lib/money";
import { getStoreMetrics } from "@/server/services/reports";
import {
  LOW_STOCK_THRESHOLD,
  listLowStock,
} from "@/server/services/stock-control";
import { getStoreDetails } from "@/server/services/stores";
import { StoreStatusBadge } from "../store-status-badge";
import { PublishButton } from "./publish-button";

export const metadata: Metadata = { title: "Overview" };

export default async function StoreOverviewPage({
  params,
}: PageProps<"/dashboard/[storeSlug]">) {
  const { storeSlug } = await params;
  const context = await requireStoreContext(storeSlug);
  const store = await getStoreDetails(context);
  const canPublish =
    roleHasPermission(context.role, "store:settings") &&
    store.status !== "SUSPENDED";

  const canSeeReports = roleHasPermission(context.role, "reports:view");
  const [metrics, lowStock] = await Promise.all([
    canSeeReports ? getStoreMetrics(context, 30) : null,
    listLowStock(context, 6),
  ]);
  const money = (cents: number) => formatMoney(cents, store.currency);
  const canAdjustStock = roleHasPermission(context.role, "inventory:adjust");

  const launchChecklist = [
    { label: "Create your store", done: true },
    { label: "Add your first product", done: store._count.products > 0 },
    // Payments are configured platform-wide (Stripe test mode) for this demo.
    { label: "Set up payments", done: getPaymentProvider() !== null },
    { label: "Publish your store", done: store.status === "ACTIVE" },
  ];

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{store.name}</h1>
        <StoreStatusBadge status={store.status} />
        <Link
          href={`/s/${store.slug}`}
          target="_blank"
          className="text-sm underline"
        >
          {store.status === "ACTIVE"
            ? "View storefront ↗"
            : "Preview storefront ↗"}
        </Link>
      </div>

      {canPublish && (
        <PublishButton
          storeSlug={store.slug}
          isPublished={store.status === "ACTIVE"}
        />
      )}

      {metrics && (
        <section aria-labelledby="sales-heading" className="space-y-3">
          <h2 id="sales-heading" className="font-semibold">
            Last {metrics.days} days
          </h2>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-stone-200 bg-stone-200 sm:grid-cols-4">
            {[
              { label: "Net sales", value: money(metrics.netSalesCents) },
              { label: "Orders", value: String(metrics.orderCount) },
              {
                label: "Average order",
                value: money(metrics.averageOrderCents),
              },
              { label: "Refunded", value: money(metrics.refundedCents) },
            ].map((figure) => (
              <div key={figure.label} className="bg-white p-4">
                <dt className="text-sm text-stone-500">{figure.label}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">
                  {figure.value}
                </dd>
              </div>
            ))}
          </dl>
          {metrics.topProducts.length > 0 && (
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-medium text-stone-500">
                Best sellers
              </h3>
              <ol className="space-y-2 text-sm">
                {metrics.topProducts.map((product) => (
                  <li
                    key={product.title}
                    className="flex justify-between gap-4"
                  >
                    <span>{product.title}</span>
                    <span className="text-stone-600 tabular-nums">
                      {product.quantity} sold · {money(product.revenueCents)}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}

      {lowStock.length > 0 && (
        <section
          aria-labelledby="low-stock-heading"
          className="rounded-xl border border-stone-200 bg-white p-5"
        >
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 id="low-stock-heading" className="font-semibold">
              Running low
            </h2>
            {canAdjustStock && (
              <Link
                href={`/dashboard/${store.slug}/inventory?low=1`}
                className="text-sm underline"
              >
                Restock
              </Link>
            )}
          </div>
          <ul className="space-y-2 text-sm">
            {lowStock.map((row) => (
              <li key={row.variantId} className="flex justify-between gap-4">
                <span>
                  {row.productTitle}
                  {row.variantTitle !== "Default" && (
                    <span className="text-stone-500">
                      {" "}
                      · {row.variantTitle}
                    </span>
                  )}
                </span>
                <span
                  className={`tabular-nums ${row.available === 0 ? "text-red-700" : "text-stone-600"}`}
                >
                  {row.available === 0 ? "Sold out" : `${row.available} left`}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-stone-500">
            Items with {LOW_STOCK_THRESHOLD} or fewer available.
          </p>
        </section>
      )}

      <dl className="grid gap-4 rounded-xl border border-stone-200 bg-white p-5 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-stone-500">Store address</dt>
          <dd className="font-medium">/s/{store.slug}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Currency</dt>
          <dd className="font-medium">{store.currency}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Team members</dt>
          <dd className="font-medium">{store._count.memberships}</dd>
        </div>
      </dl>

      <section
        aria-labelledby="launch-heading"
        className="rounded-xl border border-stone-200 bg-white p-5"
      >
        <h2 id="launch-heading" className="mb-3 font-semibold">
          Launch checklist
        </h2>
        <ul className="space-y-2 text-sm">
          {launchChecklist.map((step) => (
            <li key={step.label} className="flex items-center gap-2">
              <span
                aria-hidden
                className={`flex size-5 items-center justify-center rounded-full text-xs ${step.done ? "bg-emerald-600 text-white" : "border border-stone-300"}`}
              >
                {step.done ? "✓" : ""}
              </span>
              <span className={step.done ? "text-stone-500 line-through" : ""}>
                {step.label}
              </span>
              <span className="sr-only">
                {step.done ? "(done)" : "(not done)"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
