import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/no-access";
import type { PictureSlot } from "@/lib/validation/storefront-content";
import { requireStoreContext } from "@/server/auth/session";
import { roleHasPermission } from "@/server/permissions/roles";
import {
  getStorefrontContent,
  listFeaturableProducts,
} from "@/server/services/storefront-content";
import { getStoreDetails } from "@/server/services/stores";
import { HomepageTextForm } from "./homepage-text-form";
import { PictureSlotForm } from "./picture-slot-form";

export const metadata: Metadata = { title: "Homepage" };

type SlotInfo = { slot: PictureSlot; label: string; where: string };

// Where each picture appears depends on the store's theme, so merchants
// know what they are choosing.
const SLOTS: Record<"CLASSIC" | "BOLD", SlotInfo[]> = {
  CLASSIC: [
    {
      slot: "hero",
      label: "Main picture",
      where: "Fills the top of the page, behind the store's label.",
    },
    {
      slot: "plate-1",
      label: "Supporting picture",
      where: "Shown beside the founder's letter.",
    },
    {
      slot: "plate-2",
      label: "Letter background",
      where: "Fills the section behind the founder's letter.",
    },
    {
      slot: "letter",
      label: "Letter picture",
      where: "Set into the founder's letter.",
    },
    {
      slot: "footer",
      label: "Footer picture",
      where: "Shown in the footer, next to the shop links.",
    },
  ],
  BOLD: [
    {
      slot: "hero",
      label: "Main picture",
      where:
        "Half of the screen, beside the store card. Stays in view while shoppers scroll.",
    },
    {
      slot: "plate-1",
      label: "Second picture",
      where: "Slowly fades in after the main picture.",
    },
    {
      slot: "plate-2",
      label: "Letter picture",
      where: "Shown after the founder's letter.",
    },
    {
      slot: "footer",
      label: "Footer picture",
      where: "Fills half of the footer.",
    },
  ],
};

export default async function HomepageEditorPage({
  params,
}: PageProps<"/dashboard/[storeSlug]/homepage">) {
  const { storeSlug } = await params;
  const context = await requireStoreContext(storeSlug);
  if (!roleHasPermission(context.role, "store:settings")) {
    return (
      <NoAccess
        title="Homepage"
        message="Only the store owner can edit the homepage."
      />
    );
  }

  const [store, content, products] = await Promise.all([
    getStoreDetails(context),
    getStorefrontContent(context),
    listFeaturableProducts(context),
  ]);
  const pictures: Record<PictureSlot, typeof content.heroImage> = {
    hero: content.heroImage,
    "plate-1": content.plates[0],
    "plate-2": content.plates[1],
    letter: content.letter?.image,
    footer: content.footerImage,
  };

  return (
    <div className="max-w-4xl space-y-10">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Homepage</h1>
          <p className="mt-1 text-sm text-stone-600">
            What shoppers see first. Every part is optional: leave something
            empty and that part of the page is left out.
          </p>
        </div>
        <Link
          href={`/s/${store.slug}`}
          target="_blank"
          className="text-sm underline"
        >
          View storefront ↗
        </Link>
      </div>

      <HomepageTextForm
        storeSlug={store.slug}
        products={products}
        initialValues={{
          summary: content.summary,
          actionLabel: content.actionLabel,
          fact1: content.facts[0] ?? "",
          fact2: content.facts[1] ?? "",
          fact3: content.facts[2] ?? "",
          featuredProductSlug: content.featuredProductSlug ?? "",
          letterText: content.letter?.paragraphs.join("\n\n") ?? "",
          letterSignedBy: content.letter?.signedBy ?? "",
          letterRole: content.letter?.role ?? "",
        }}
      />

      <section aria-labelledby="pictures-heading" className="space-y-4">
        <div>
          <h2 id="pictures-heading" className="text-lg font-semibold">
            Pictures
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Use your own photographs, or openly licensed pictures from museums
            and archives. If the licence asks for a credit, add it: credits are
            shown in the footer.
          </p>
        </div>
        {SLOTS[store.theme].map((info) => (
          <PictureSlotForm
            key={info.slot}
            storeSlug={store.slug}
            slot={info.slot}
            label={info.label}
            where={info.where}
            picture={pictures[info.slot] ?? null}
            disabledReason={
              info.slot === "letter" && !content.letter
                ? "Write the founder's letter above first."
                : null
            }
          />
        ))}
      </section>
    </div>
  );
}
