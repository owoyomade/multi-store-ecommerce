import type { Metadata } from "next";
import Link from "next/link";
import type { InventoryMovementReason } from "@/generated/prisma/client";
import { NoAccess } from "@/components/no-access";
import { firstParam } from "@/lib/search-params";
import { requireStoreContext } from "@/server/auth/session";
import { roleHasPermission } from "@/server/permissions/roles";
import { userNames } from "@/server/services/staff";
import {
  LOW_STOCK_THRESHOLD,
  listStock,
  listStockMovements,
} from "@/server/services/stock-control";
import { adjustStockAction } from "./actions";
import { AdjustStockForm } from "./adjust-stock-form";

export const metadata: Metadata = { title: "Inventory" };

const REASON_LABELS: Record<InventoryMovementReason, string> = {
  INITIAL_STOCK: "Starting stock",
  ADJUSTMENT: "Correction",
  RESTOCK: "Received stock",
  SALE: "Sold",
  RETURN: "Return",
};

export default async function InventoryPage({
  params,
  searchParams,
}: PageProps<"/dashboard/[storeSlug]/inventory">) {
  const { storeSlug } = await params;
  const query = await searchParams;
  const context = await requireStoreContext(storeSlug);
  if (!roleHasPermission(context.role, "inventory:adjust")) {
    return (
      <NoAccess
        title="Inventory"
        message="Your role doesn't include adjusting stock."
      />
    );
  }

  const lowOnly = firstParam(query.low) === "1";
  const rows = await listStock(context, { lowOnly });
  const selected = rows.find(
    (row) => row.variantId === firstParam(query.variant),
  );
  const movements = selected
    ? await listStockMovements(context, selected.variantId)
    : [];
  const names = await userNames(
    movements.map((movement) => movement.actorUserId),
  );
  const base = `/dashboard/${storeSlug}/inventory`;
  const linkFor = (variantId?: string) => {
    const search = new URLSearchParams();
    if (lowOnly) search.set("low", "1");
    if (variantId) search.set("variant", variantId);
    const text = search.toString();
    return text ? `${base}?${text}` : base;
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <p className="mt-1 text-sm text-stone-600">
          Record stock you receive, returns and corrections. Every change is
          kept in each item&apos;s history. “Held” units are in checkouts that
          haven&apos;t finished yet.
        </p>
      </div>

      <nav aria-label="Filter" className="flex gap-2 text-sm">
        <Link
          href={selected ? `${base}?variant=${selected.variantId}` : base}
          aria-current={!lowOnly ? "page" : undefined}
          className="rounded-full border border-stone-300 px-3 py-1 aria-[current=page]:border-stone-900 aria-[current=page]:bg-stone-900 aria-[current=page]:text-white"
        >
          All items
        </Link>
        <Link
          href={`${base}?low=1`}
          aria-current={lowOnly ? "page" : undefined}
          className="rounded-full border border-stone-300 px-3 py-1 aria-[current=page]:border-stone-900 aria-[current=page]:bg-stone-900 aria-[current=page]:text-white"
        >
          Low stock ({LOW_STOCK_THRESHOLD} or fewer)
        </Link>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-600">
            {lowOnly
              ? "Nothing is running low."
              : "No products track stock yet."}
          </p>
        ) : (
          <div className="self-start overflow-x-auto rounded-xl border border-stone-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-200 text-stone-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Item</th>
                  <th className="px-4 py-3 font-medium">SKU</th>
                  <th className="px-4 py-3 text-right font-medium">On hand</th>
                  <th className="px-4 py-3 text-right font-medium">Held</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Available
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((row) => (
                  <tr
                    key={row.variantId}
                    className={
                      row.variantId === selected?.variantId
                        ? "bg-stone-50"
                        : undefined
                    }
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={linkFor(row.variantId)}
                        className="font-medium underline-offset-2 hover:underline"
                      >
                        {row.productTitle}
                      </Link>
                      {row.variantTitle !== "Default" && (
                        <span className="text-stone-500">
                          {" "}
                          · {row.variantTitle}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-stone-600">
                      {row.sku}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {row.onHand}
                    </td>
                    <td className="px-4 py-3 text-right text-stone-500 tabular-nums">
                      {row.reserved}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium tabular-nums ${row.available <= LOW_STOCK_THRESHOLD ? "text-red-700" : ""}`}
                    >
                      {row.available}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <aside className="self-start rounded-xl border border-stone-200 bg-white p-5">
          {selected ? (
            <div className="space-y-5">
              <div>
                <h2 className="font-semibold">
                  {selected.productTitle}
                  {selected.variantTitle !== "Default" &&
                    ` · ${selected.variantTitle}`}
                </h2>
                <p className="text-sm text-stone-500">
                  {selected.onHand} on hand · {selected.available} available
                </p>
              </div>
              {/* Re-keying on the count clears the form after each saved change. */}
              <AdjustStockForm
                key={`${selected.variantId}-${selected.onHand}`}
                action={adjustStockAction.bind(
                  null,
                  storeSlug,
                  selected.variantId,
                )}
              />
              <div>
                <h3 className="mb-2 text-sm font-medium text-stone-500">
                  History
                </h3>
                {movements.length === 0 ? (
                  <p className="text-sm text-stone-600">
                    No changes recorded yet.
                  </p>
                ) : (
                  <ol className="space-y-2 text-sm">
                    {movements.map((movement) => (
                      <li key={movement.id} className="flex gap-3">
                        <span
                          className={`w-12 shrink-0 text-right font-medium tabular-nums ${movement.delta < 0 ? "text-red-700" : "text-green-800"}`}
                        >
                          {movement.delta > 0
                            ? `+${movement.delta}`
                            : movement.delta}
                        </span>
                        <span>
                          {REASON_LABELS[movement.reason]}
                          {movement.note && (
                            <span className="text-stone-600">
                              {" "}
                              · {movement.note}
                            </span>
                          )}
                          <span className="block text-xs text-stone-500">
                            {movement.createdAt.toLocaleString("en-CA")} ·{" "}
                            {movement.actorUserId
                              ? (names[movement.actorUserId] ?? "staff")
                              : "system"}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-stone-600">
              Choose an item to record a change or see its history.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
