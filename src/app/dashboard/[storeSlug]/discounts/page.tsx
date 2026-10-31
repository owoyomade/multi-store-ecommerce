import type { Metadata } from "next";
import type { Discount } from "@/generated/prisma/client";
import { NoAccess } from "@/components/no-access";
import { formatMoney } from "@/lib/money";
import { requireStoreContext } from "@/server/auth/session";
import { roleHasPermission } from "@/server/permissions/roles";
import { listDiscounts } from "@/server/services/discounts";
import { getStoreDetails } from "@/server/services/stores";
import { createDiscountAction, setDiscountActiveAction } from "./actions";
import { DiscountForm } from "./discount-form";

export const metadata: Metadata = { title: "Discounts" };

/** What a shopper would see the code as worth, e.g. "15% off" or "$10.00 off". */
function describeValue(discount: Discount, currency: string): string {
  return discount.kind === "PERCENT"
    ? `${discount.value / 100}% off`
    : `${formatMoney(discount.value, currency)} off`;
}

function describeState(discount: Discount, now: Date): string {
  if (!discount.active) return "Paused";
  if (discount.startsAt && discount.startsAt > now) return "Scheduled";
  if (discount.endsAt && discount.endsAt <= now) return "Expired";
  if (
    discount.usageLimit !== null &&
    discount.usageCount >= discount.usageLimit
  )
    return "Used up";
  return "Active";
}

export default async function DiscountsPage({
  params,
}: PageProps<"/dashboard/[storeSlug]/discounts">) {
  const { storeSlug } = await params;
  const context = await requireStoreContext(storeSlug);
  if (!roleHasPermission(context.role, "discounts:manage")) {
    return (
      <NoAccess
        title="Discounts"
        message="Your role doesn't include managing discount codes."
      />
    );
  }
  const [discounts, store] = await Promise.all([
    listDiscounts(context),
    getStoreDetails(context),
  ]);
  const now = new Date();

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Discounts</h1>
        <p className="mt-1 text-sm text-stone-600">
          Codes shoppers enter at checkout. Each order can use one code, and the
          discount comes off the goods before shipping and tax.
        </p>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-4 font-semibold">New code</h2>
        {/* Re-keying on the count clears the form after a code is created. */}
        <DiscountForm
          key={discounts.length}
          action={createDiscountAction.bind(null, storeSlug)}
          currency={store.currency}
        />
      </section>

      {discounts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-600">
          No discount codes yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-stone-200 text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Discount</th>
                <th className="px-4 py-3 font-medium">Rules</th>
                <th className="px-4 py-3 font-medium">Used</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {discounts.map((discount) => (
                <tr key={discount.id}>
                  <td className="px-4 py-3 font-mono font-medium">
                    {discount.code}
                  </td>
                  <td className="px-4 py-3">
                    {describeValue(discount, store.currency)}
                  </td>
                  <td className="px-4 py-3 text-stone-600">
                    {[
                      discount.minSubtotalCents &&
                        `Orders over ${formatMoney(discount.minSubtotalCents, store.currency)}`,
                      discount.startsAt &&
                        `From ${discount.startsAt.toLocaleDateString("en-CA")}`,
                      discount.endsAt &&
                        `Until ${discount.endsAt.toLocaleDateString("en-CA")}`,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "None"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                    {discount.usageCount}
                    {discount.usageLimit !== null &&
                      ` / ${discount.usageLimit}`}
                  </td>
                  <td className="px-4 py-3">{describeState(discount, now)}</td>
                  <td className="px-4 py-3 text-right">
                    <form
                      action={setDiscountActiveAction.bind(
                        null,
                        storeSlug,
                        discount.id,
                        !discount.active,
                      )}
                    >
                      <button type="submit" className="text-sm underline">
                        {discount.active ? "Pause" : "Activate"}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
