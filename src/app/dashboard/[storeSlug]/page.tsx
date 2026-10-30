import type { Metadata } from "next";
import Link from "next/link";
import { requireStoreContext } from "@/server/auth/session";
import { roleHasPermission } from "@/server/permissions/roles";
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

  // Payment setup arrives with checkout in Phase 3.
  const launchChecklist = [
    { label: "Create your store", done: true },
    { label: "Add your first product", done: store._count.products > 0 },
    { label: "Set up payments", done: false },
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
