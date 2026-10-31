import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import { Pagination } from "@/components/pagination";
import { buttonClasses } from "@/components/ui/button";
import type { OrderStatus } from "@/generated/prisma/enums";
import { formatMoney } from "@/lib/money";
import { oneOf, pageParam, toQueryString } from "@/lib/search-params";
import { requireStoreContext } from "@/server/auth/session";
import { roleHasPermission } from "@/server/permissions/roles";
import { listOrders } from "@/server/services/orders";
import { OrderStatusBadge } from "./order-status-badge";

export const metadata: Metadata = { title: "Orders" };

const STATUSES: OrderStatus[] = [
  "PENDING",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
];

/** The last 30 days, today included, as YYYY-MM-DD values for date inputs. */
function defaultExportRange() {
  const day = (time: number) => new Date(time).toISOString().slice(0, 10);
  const now = Date.now();
  return {
    exportFrom: day(now - 29 * 24 * 60 * 60 * 1000),
    exportTo: day(now),
  };
}

export default async function OrdersPage({
  params,
  searchParams,
}: PageProps<"/dashboard/[storeSlug]/orders">) {
  const { storeSlug } = await params;
  const context = await requireStoreContext(storeSlug);
  if (!roleHasPermission(context.role, "orders:view")) {
    return (
      <NoAccess
        title="Orders"
        message="Your role doesn't include viewing orders."
      />
    );
  }
  const query = await searchParams;
  const status = oneOf(query.status, STATUSES);
  const listing = await listOrders(context, {
    status,
    page: pageParam(query.page),
  });
  const basePath = `/dashboard/${storeSlug}/orders`;
  const canExport = roleHasPermission(context.role, "reports:view");
  const { exportFrom, exportTo } = defaultExportRange();

  return (
    <div className="max-w-5xl">
      <h1 className="mb-6 text-2xl font-semibold">Orders</h1>
      {canExport && (
        // A plain GET form: the browser downloads the file the route returns.
        <form
          action={`${basePath}/export`}
          className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-stone-200 bg-white p-4 text-sm"
        >
          <label className="space-y-1">
            <span className="block font-medium">From</span>
            <input
              type="date"
              name="from"
              defaultValue={exportFrom}
              className="rounded-md border border-stone-300 px-3 py-2"
            />
          </label>
          <label className="space-y-1">
            <span className="block font-medium">To</span>
            <input
              type="date"
              name="to"
              defaultValue={exportTo}
              className="rounded-md border border-stone-300 px-3 py-2"
            />
          </label>
          <button type="submit" className={buttonClasses("secondary")}>
            Download CSV
          </button>
          <span className="text-stone-500">
            Paid, shipped, cancelled and refunded orders. Dates are UTC.
          </span>
        </form>
      )}
      <form className="mb-4 flex gap-2">
        <label htmlFor="order-status" className="sr-only">
          Status
        </label>
        <select
          id="order-status"
          name="status"
          defaultValue={status ?? ""}
          className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((value) => (
            <option key={value} value={value}>
              {value.charAt(0) + value.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClasses("secondary")}>
          Filter
        </button>
      </form>

      {listing.orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-10 text-center">
          <h2 className="font-medium">
            {status ? "No orders with this status" : "No orders yet"}
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Orders appear here as soon as a shopper starts checkout.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-xs text-stone-500 uppercase">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Order
                </th>
                <th scope="col" className="px-4 py-3">
                  Date
                </th>
                <th scope="col" className="px-4 py-3">
                  Customer
                </th>
                <th scope="col" className="px-4 py-3">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {listing.orders.map((order) => (
                <tr key={order.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`${basePath}/${order.id}`}
                      className="underline-offset-2 hover:underline"
                    >
                      #{order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {order.createdAt.toLocaleDateString("en-CA")}
                  </td>
                  <td className="px-4 py-3 text-stone-600">{order.email}</td>
                  <td className="px-4 py-3">
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {formatMoney(order.totalCents, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination
        page={listing.page}
        pageCount={listing.pageCount}
        hrefForPage={(page) => `${basePath}${toQueryString({ status, page })}`}
      />
    </div>
  );
}
