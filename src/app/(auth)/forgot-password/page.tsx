import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <p className="mt-1 mb-6 text-sm text-stone-600">
        We&apos;ll email you a link to choose a new one.
      </p>
      <ForgotPasswordForm />
      <Link href="/sign-in" className="mt-6 inline-block text-sm underline">
        Back to sign in
      </Link>
    </>
  );
}
