import { formatMoney } from "@/lib/money";
import type { ShippingAddress } from "@/lib/validation/checkout";

type OrderSummaryProps = {
  currency: string;
  items: {
    id: string;
    productTitle: string;
    variantTitle: string;
    quantity: number;
    lineTotalCents: number;
  }[];
  subtotalCents: number;
  discountCents?: number;
  discountCode?: string | null;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
};

/** Line items and totals, shared by the storefront and the dashboard. */
export function OrderSummary({
  currency,
  items,
  subtotalCents,
  discountCents = 0,
  discountCode,
  shippingCents,
  taxCents,
  totalCents,
}: OrderSummaryProps) {
  const money = (cents: number) => formatMoney(cents, currency);
  return (
    <div className="text-sm">
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.id} className="flex justify-between gap-4 py-2">
            <span>
              {item.quantity} × {item.productTitle}
              {item.variantTitle !== "Default" && (
                <span className="opacity-70"> ({item.variantTitle})</span>
              )}
            </span>
            <span>{money(item.lineTotalCents)}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-5 space-y-1">
        <div className="flex justify-between">
          <dt className="opacity-70">Subtotal</dt>
          <dd>{money(subtotalCents)}</dd>
        </div>
        {discountCents > 0 && (
          <div className="flex justify-between">
            <dt className="opacity-70">
              Discount{discountCode ? ` (${discountCode})` : ""}
            </dt>
            <dd>−{money(discountCents)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="opacity-70">Shipping</dt>
          <dd>{shippingCents === 0 ? "Free" : money(shippingCents)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="opacity-70">Tax (demo rate)</dt>
          <dd>{money(taxCents)}</dd>
        </div>
        <div className="flex justify-between pt-1 text-base font-semibold">
          <dt>Total</dt>
          <dd>{money(totalCents)}</dd>
        </div>
      </dl>
    </div>
  );
}

export function AddressBlock({ address }: { address: ShippingAddress }) {
  return (
    <address className="text-sm not-italic">
      {address.name}
      <br />
      {address.line1}
      {address.line2 && (
        <>
          <br />
          {address.line2}
        </>
      )}
      <br />
      {address.city}
      {address.region && `, ${address.region}`} {address.postalCode}
      <br />
      {address.country}
      {address.phone && (
        <>
          <br />
          {address.phone}
        </>
      )}
    </address>
  );
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Awaiting payment",
  PAID: "Paid",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export function orderStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}
