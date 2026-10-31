"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { SelectField, TextAreaField, TextField } from "@/components/ui/field";
import { fieldErrorsOf, idleFormState, submittedValue } from "@/lib/form-state";
import { saveHomepageTextAction } from "./actions";

type Values = {
  summary: string;
  actionLabel: string;
  fact1: string;
  fact2: string;
  fact3: string;
  featuredProductSlug: string;
  letterText: string;
  letterSignedBy: string;
  letterRole: string;
};

type HomepageTextFormProps = {
  storeSlug: string;
  products: { slug: string; title: string }[];
  initialValues: Values;
};

export function HomepageTextForm({
  storeSlug,
  products,
  initialValues,
}: HomepageTextFormProps) {
  const [state, formAction, pending] = useActionState(
    saveHomepageTextAction.bind(null, storeSlug),
    idleFormState,
  );
  const value = (field: keyof Values) =>
    submittedValue(state, field, initialValues[field]);
  const errors = (field: string) => fieldErrorsOf(state, field);

  return (
    <form action={formAction} className="space-y-6">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      {state.status === "success" && (
        <Alert tone="success">{state.message}</Alert>
      )}

      <fieldset className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold">Top of the page</legend>
        <TextAreaField
          label="Summary"
          name="summary"
          rows={2}
          maxLength={160}
          defaultValue={value("summary")}
          hint="One sentence saying plainly what you sell. Up to 160 characters."
          errors={errors("summary")}
        />
        <TextField
          label="Button label"
          name="actionLabel"
          maxLength={30}
          defaultValue={value("actionLabel")}
          placeholder="Shop now"
          hint="What shoppers do when they press it, e.g. “Shop the roasts”."
          errors={errors("actionLabel")}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          {(["fact1", "fact2", "fact3"] as const).map((field, index) => (
            <TextField
              key={field}
              label={`Fact ${index + 1}`}
              name={field}
              maxLength={40}
              defaultValue={value(field)}
              placeholder={
                [
                  "Made in Toronto",
                  "Ships across Canada",
                  "Free shipping over $75",
                ][index]
              }
              errors={errors(`facts.${index}`)}
            />
          ))}
        </div>
        <SelectField
          label="Featured product"
          name="featuredProductSlug"
          defaultValue={value("featuredProductSlug")}
          options={[
            { value: "", label: "Your newest product (automatic)" },
            ...products.map((product) => ({
              value: product.slug,
              label: product.title,
            })),
          ]}
          hint="Shown in full on the homepage, where shoppers can add it to their cart."
          errors={errors("featuredProductSlug")}
        />
      </fieldset>

      <fieldset className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
        <legend className="px-1 text-sm font-semibold">
          Founder&apos;s letter
        </legend>
        <p className="text-sm text-stone-600">
          A short note in your own words. Leave it empty to leave the letter off
          the homepage.
        </p>
        <TextAreaField
          label="Letter"
          name="letterText"
          rows={9}
          defaultValue={value("letterText")}
          hint="Separate paragraphs with an empty line. Up to six paragraphs."
          errors={errors("letterText")}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Signed by"
            name="letterSignedBy"
            maxLength={80}
            defaultValue={value("letterSignedBy")}
            errors={errors("letterSignedBy")}
          />
          <TextField
            label="Their role"
            name="letterRole"
            maxLength={80}
            defaultValue={value("letterRole")}
            placeholder="Founder"
            errors={errors("letterRole")}
          />
        </div>
      </fieldset>

      <Button type="submit" pending={pending} pendingLabel="Saving…">
        Save homepage
      </Button>
    </form>
  );
}
