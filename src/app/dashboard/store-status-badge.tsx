import type { StoreStatus } from "@/generated/prisma/enums";

const statusStyles: Record<StoreStatus, { label: string; className: string }> =
  {
    DRAFT: { label: "Draft", className: "bg-stone-100 text-stone-700" },
    ACTIVE: { label: "Live", className: "bg-emerald-100 text-emerald-800" },
    SUSPENDED: { label: "Suspended", className: "bg-red-100 text-red-800" },
  };

export function StoreStatusBadge({ status }: { status: StoreStatus }) {
  const { label, className } = statusStyles[status];
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
