import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { firstParam } from "@/lib/search-params";
import { requireUser } from "@/server/auth/session";
import { TwoFactorSettings } from "./two-factor-settings";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage({
  searchParams,
}: PageProps<"/dashboard/security">) {
  const user = await requireUser({ allowMissingAdminTwoFactor: true });
  const required = firstParam((await searchParams).required) === "1";

  return (
    <main className="mx-auto w-full max-w-xl flex-1 space-y-6 px-4 py-10 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold">Security</h1>
        <p className="mt-1 text-sm text-stone-600">
          Signed in as {user.email}.
        </p>
      </div>
      {required && !user.twoFactorEnabled && (
        <Alert tone="info">
          Platform admins must turn on two-step sign-in before using the
          dashboard.
        </Alert>
      )}
      <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-5">
        <div>
          <h2 className="font-semibold">
            Two-step sign-in{" "}
            <span className="text-sm font-normal text-stone-500">
              ({user.twoFactorEnabled ? "on" : "off"})
            </span>
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            {user.twoFactorEnabled
              ? "Signing in needs your password and a code from your authenticator app."
              : "Ask for a code from your phone as well as your password, so a leaked password alone can't open your stores."}
          </p>
        </div>
        <TwoFactorSettings enabled={user.twoFactorEnabled} />
      </section>
    </main>
  );
}
