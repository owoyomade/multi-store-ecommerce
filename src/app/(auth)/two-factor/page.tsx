import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TwoFactorForm } from "./two-factor-form";

export const metadata: Metadata = { title: "Enter your code" };

export default function TwoFactorPage() {
  return (
    <>
      <h1 className="mb-2 text-xl font-semibold">Two-step sign-in</h1>
      <p className="mb-6 text-sm text-stone-600">
        Open your authenticator app and enter the code shown for Storefront
        Studio.
      </p>
      <Suspense>
        <TwoFactorForm />
      </Suspense>
      <p className="mt-6 text-sm text-stone-600">
        <Link href="/sign-in" className="underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
