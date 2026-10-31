"use client";

import Image from "next/image";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { fieldErrorsOf, idleFormState, submittedValue } from "@/lib/form-state";
import type {
  PictureSlot,
  StoreImage,
} from "@/lib/validation/storefront-content";
import {
  removeHomepagePictureAction,
  saveHomepagePictureAction,
} from "./actions";

type PictureSlotFormProps = {
  storeSlug: string;
  slot: PictureSlot;
  label: string;
  where: string;
  picture: StoreImage | null;
  disabledReason: string | null;
};

/**
 * One picture on the homepage: preview, replace, edit its words, remove.
 * Saving without choosing a file keeps the current picture and only updates
 * its alt text, caption and credit.
 */
export function PictureSlotForm({
  storeSlug,
  slot,
  label,
  where,
  picture,
  disabledReason,
}: PictureSlotFormProps) {
  const [state, formAction, pending] = useActionState(
    saveHomepagePictureAction.bind(null, storeSlug, slot),
    idleFormState,
  );
  const errors = (field: string) => fieldErrorsOf(state, field);
  const headingId = `slot-${slot}`;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-xl border border-stone-200 bg-white p-5"
    >
      <div className="grid gap-5 sm:grid-cols-[180px_1fr]">
        <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-lg bg-stone-100">
          {picture ? (
            <Image
              src={`/media/${picture.storageKey}`}
              alt={picture.alt}
              width={picture.width}
              height={picture.height}
              sizes="180px"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-sm text-stone-500">No picture</span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h3 id={headingId} className="font-semibold">
              {label}
            </h3>
            <p className="text-sm text-stone-600">{where}</p>
          </div>

          {disabledReason ? (
            <p className="text-sm text-stone-600">{disabledReason}</p>
          ) : (
            <form action={formAction} className="space-y-4">
              {state.status === "error" && (
                <Alert tone="error">{state.message}</Alert>
              )}
              {state.status === "success" && (
                <Alert tone="success">{state.message}</Alert>
              )}
              <TextField
                label={picture ? "Replace with a new picture" : "Picture file"}
                name="image"
                type="file"
                // A hint for the file picker only; the server checks the real file contents.
                accept="image/jpeg,image/png,image/webp,image/avif"
                required={!picture}
                hint="JPEG, PNG, WebP or AVIF, up to 5 MB."
              />
              <TextField
                label="Alt text"
                name="alt"
                required
                maxLength={200}
                defaultValue={submittedValue(state, "alt", picture?.alt ?? "")}
                hint="Describe the picture for shoppers using screen readers."
                errors={errors("alt")}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Caption"
                  name="caption"
                  maxLength={160}
                  defaultValue={submittedValue(
                    state,
                    "caption",
                    picture?.caption ?? "",
                  )}
                  hint="Shown with the picture, e.g. “Toronto, 1905”."
                  errors={errors("caption")}
                />
                <TextField
                  label="Credit"
                  name="credit"
                  maxLength={300}
                  defaultValue={submittedValue(
                    state,
                    "credit",
                    picture?.credit ?? "",
                  )}
                  hint="Who made it and its licence, if the licence asks for credit."
                  errors={errors("credit")}
                />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <Button
                  type="submit"
                  variant="secondary"
                  pending={pending}
                  pendingLabel="Saving…"
                >
                  {picture ? "Save picture" : "Upload picture"}
                </Button>
              </div>
            </form>
          )}

          {picture && !disabledReason && (
            <form
              action={removeHomepagePictureAction.bind(null, storeSlug, slot)}
            >
              <button type="submit" className="text-sm text-red-700 underline">
                Remove picture
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
