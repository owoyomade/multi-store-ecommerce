import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <>
      <h1 className="text-xl font-semibold">Check your email</h1>
      <p className="mt-2 text-sm text-stone-600">
        We&apos;ve sent you a link to verify your email address. Open it to
        finish signing up. The link expires in 1 hour.
      </p>
      <p className="mt-4 text-sm text-stone-600">
        Running locally? Emails arrive in Mailpit at{" "}
        <a
          href="http://localhost:8030"
          className="font-medium text-stone-900 underline"
        >
          localhost:8030
        </a>
        .
      </p>
      <Link
        href="/sign-in"
        className="mt-6 inline-block text-sm font-medium text-stone-900 underline"
      >
        Back to sign in
      </Link>
    </>
  );
}
