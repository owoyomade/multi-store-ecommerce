import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Sign in</h1>
      <Suspense>
        <SignInForm />
      </Suspense>
      <div className="mt-6 flex justify-between text-sm text-stone-600">
        <Link href="/forgot-password" className="underline">
          Forgot password?
        </Link>
        <Link href="/sign-up" className="font-medium text-stone-900 underline">
          Create account
        </Link>
      </div>
    </>
  );
}
