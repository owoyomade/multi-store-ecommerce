import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { roleHasPermission } from "@/server/permissions/roles";
import { requireStoreContext } from "@/server/auth/session";
import { getStoreDetails } from "@/server/services/stores";
import { BrandingForm } from "./branding-form";

export const metadata: Metadata = { title: "Settings" };

export default async function StoreSettingsPage({
  params,
}: PageProps<"/dashboard/[storeSlug]/settings">) {
  const { storeSlug } = await params;
  const context = await requireStoreContext(storeSlug);

  if (!roleHasPermission(context.role, "store:settings")) {
    return (
      <div className="max-w-xl">
        <h1 className="mb-4 text-2xl font-semibold">Settings</h1>
        <Alert tone="info">Only the store owner can change settings.</Alert>
      </div>
    );
  }

  const store = await getStoreDetails(context);
  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>
      <BrandingForm
        storeSlug={store.slug}
        initialValues={{
          name: store.name,
          contactEmail: store.contactEmail,
          primaryColor: store.primaryColor,
          accentColor: store.accentColor,
          theme: store.theme,
          tagline: store.tagline ?? "",
        }}
      />
    </div>
  );
}
