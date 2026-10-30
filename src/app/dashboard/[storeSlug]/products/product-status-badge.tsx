import type { ProductStatus } from "@/generated/prisma/enums";

const styles: Record<ProductStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-stone-100 text-stone-700" },
  PUBLISHED: {
    label: "Published",
    className: "bg-emerald-100 text-emerald-800",
  },
  ARCHIVED: { label: "Archived", className: "bg-amber-100 text-amber-800" },
};

export function ProductStatusBadge({ status }: { status: ProductStatus }) {
  const { label, className } = styles[status];
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}
