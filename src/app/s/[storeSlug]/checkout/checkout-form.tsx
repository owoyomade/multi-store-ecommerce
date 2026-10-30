"use client";

import { useActionState, useState } from "react";
import { fieldErrorsOf, idleFormState, submittedValue } from "@/lib/form-state";
import { SUPPORTED_COUNTRIES } from "@/lib/validation/store";
import { startCheckoutAction } from "./actions";

type SavedAddress = {
  id: string;
  name: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone: string;
};

type CheckoutFormProps = {
  storeSlug: string;
  idempotencyKey: string;
  defaultEmail: string;
  savedAddresses: SavedAddress[];
  canSaveAddress: boolean;
  paymentsReady: boolean;
};

const inputClasses =
  "w-full rounded-[var(--sf-radius)] border border-current/25 bg-white px-3 py-2 text-stone-900 aria-invalid:border-red-600";

export function CheckoutForm({
  storeSlug,
  idempotencyKey,
  defaultEmail,
  savedAddresses,
  canSaveAddress,
  paymentsReady,
}: CheckoutFormProps) {
  const [state, formAction, pending] = useActionState(
    startCheckoutAction.bind(null, storeSlug, idempotencyKey),
    idleFormState,
  );
  // Choosing a saved address re-mounts the address fields with its values.
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(
    savedAddresses[0] ?? null,
  );

  const fieldProps = (name: keyof Omit<SavedAddress, "id"> | "email") => ({
    name,
    errors: fieldErrorsOf(state, name),
    defaultValue: submittedValue(
      state,
      name,
      name === "email" ? defaultEmail : (selectedAddress?.[name] ?? ""),
    ),
  });

  const countryErrors = fieldErrorsOf(state, "country");

  return (
    <form action={formAction} className="space-y-6">
      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-[var(--sf-radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {state.message}
        </p>
      )}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="sf-heading mb-2 text-lg font-semibold">
          Contact
        </legend>
        <CheckoutField
          {...fieldProps("email")}
          label="Email"
          autoComplete="email"
          wide
        />
      </fieldset>

      <fieldset
        className="grid gap-4 sm:grid-cols-2"
        key={selectedAddress?.id ?? "new"}
      >
        <legend className="sf-heading mb-2 text-lg font-semibold">
          Shipping address
        </legend>
        {savedAddresses.length > 0 && (
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor="saved-address" className="text-sm">
              Saved addresses
            </label>
            <select
              id="saved-address"
              value={selectedAddress?.id ?? ""}
              onChange={(event) =>
                setSelectedAddress(
                  savedAddresses.find(
                    (address) => address.id === event.target.value,
                  ) ?? null,
                )
              }
              className={inputClasses}
            >
              {savedAddresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {address.name}, {address.line1}, {address.city}
                </option>
              ))}
              <option value="">Use a new address</option>
            </select>
          </div>
        )}
        <CheckoutField
          {...fieldProps("name")}
          label="Full name"
          autoComplete="name"
          wide
        />
        <CheckoutField
          {...fieldProps("line1")}
          label="Address"
          autoComplete="address-line1"
          wide
        />
        <CheckoutField
          {...fieldProps("line2")}
          label="Apartment, suite, etc."
          autoComplete="address-line2"
          required={false}
          wide
        />
        <CheckoutField
          {...fieldProps("city")}
          label="City"
          autoComplete="address-level2"
        />
        <CheckoutField
          {...fieldProps("region")}
          label="Province / state"
          autoComplete="address-level1"
          required={false}
        />
        <CheckoutField
          {...fieldProps("postalCode")}
          label="Postal code"
          autoComplete="postal-code"
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="checkout-country" className="text-sm">
            Country
          </label>
          <select
            id="checkout-country"
            name="country"
            autoComplete="country"
            defaultValue={submittedValue(
              state,
              "country",
              selectedAddress?.country ?? "CA",
            )}
            aria-invalid={countryErrors ? true : undefined}
            className={inputClasses}
          >
            {Object.entries(SUPPORTED_COUNTRIES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </div>
        <CheckoutField
          {...fieldProps("phone")}
          label="Phone"
          autoComplete="tel"
          required={false}
          wide
        />
        {canSaveAddress && !selectedAddress && (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="saveAddress" className="size-4" />
            Save this address for next time
          </label>
        )}
      </fieldset>

      {!paymentsReady && (
        <p className="rounded-[var(--sf-radius)] bg-amber-100 p-3 text-sm text-amber-900">
          Payments aren&apos;t set up for this demo yet, so orders can&apos;t be
          placed.
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={!paymentsReady || pending}
          className="w-full rounded-[var(--sf-radius)] bg-[var(--sf-accent)] px-6 py-3 font-medium text-[var(--sf-on-accent)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Reserving your items…" : "Continue to payment"}
        </button>
        <p className="mt-2 text-center text-xs opacity-70">
          You&apos;ll pay on Stripe&apos;s secure page (test mode — use card
          4242 4242 4242 4242). Your items are held for 30 minutes.
        </p>
      </div>
    </form>
  );
}

type CheckoutFieldProps = {
  name: string;
  label: string;
  autoComplete: string;
  defaultValue: string;
  errors?: string[];
  required?: boolean;
  wide?: boolean;
};

function CheckoutField({
  name,
  label,
  autoComplete,
  defaultValue,
  errors,
  required = true,
  wide = false,
}: CheckoutFieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${wide ? "sm:col-span-2" : ""}`}>
      <label htmlFor={`checkout-${name}`} className="text-sm">
        {label}
        {!required && <span className="opacity-60"> (optional)</span>}
      </label>
      <input
        id={`checkout-${name}`}
        name={name}
        type={name === "email" ? "email" : "text"}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={errors ? true : undefined}
        aria-describedby={errors ? `checkout-${name}-error` : undefined}
        className={inputClasses}
      />
      {errors && (
        <p id={`checkout-${name}-error`} className="text-xs text-red-700">
          {errors.join(" ")}
        </p>
      )}
    </div>
  );
}
