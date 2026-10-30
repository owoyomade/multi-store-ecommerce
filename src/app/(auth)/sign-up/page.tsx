import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignUpForm } from "./sign-up-form";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Create your account</h1>
      <p className="mt-1 mb-6 text-sm text-stone-600">
        Start selling with your first store in minutes.
      </p>
      <Suspense>
        <SignUpForm />
      </Suspense>
      <p className="mt-6 text-center text-sm text-stone-600">
        Already have an account?{" "}
        <Link href="/sign-in" className="font-medium text-stone-900 underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
