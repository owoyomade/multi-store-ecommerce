import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  // Better Auth redirects here with ?token=... on success or ?error=INVALID_TOKEN.
  const { token, error } = await searchParams;
  const validToken = typeof token === "string" && !error ? token : null;

  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Choose a new password</h1>
      {validToken ? (
        <ResetPasswordForm token={validToken} />
      ) : (
        <>
          <Alert tone="error">This reset link is invalid or has expired.</Alert>
          <Link
            href="/forgot-password"
            className="mt-4 inline-block text-sm underline"
          >
            Request a new link
          </Link>
        </>
      )}
    </>
  );
}
