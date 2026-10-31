import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonClasses } from "@/components/ui/button";
import { getCurrentUser } from "@/server/auth/session";
import { ROLE_LABELS } from "@/server/permissions/roles";
import { findInvite } from "@/server/services/staff";
import { acceptInviteAction } from "./actions";

export const metadata: Metadata = { title: "Team invitation" };

export default async function InvitePage({
  params,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const invite = await findInvite(token);

  if (invite.status === "invalid") {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold">
          This invitation can&apos;t be used
        </h1>
        <p className="text-sm text-stone-600">
          It may have expired, already been accepted, or been replaced by a
          newer invite. Ask the store owner to send a new one.
        </p>
      </div>
    );
  }

  const user = await getCurrentUser();
  const here = `/invite/${token}`;
  const intro = (
    <>
      <h1 className="text-xl font-semibold">Join {invite.storeName}</h1>
      <p className="text-sm text-stone-600">
        You&apos;ve been invited as <strong>{ROLE_LABELS[invite.role]}</strong>.
        This invitation is for <strong>{invite.email}</strong>.
      </p>
    </>
  );

  if (!user) {
    return (
      <div className="space-y-4">
        {intro}
        <div className="flex flex-col gap-2">
          <Link
            href={`/sign-in?next=${encodeURIComponent(here)}`}
            className={buttonClasses("primary")}
          >
            Sign in to accept
          </Link>
          <Link
            href={`/sign-up?next=${encodeURIComponent(here)}`}
            className={buttonClasses("secondary")}
          >
            Create an account
          </Link>
        </div>
      </div>
    );
  }

  if (user.email.toLowerCase() !== invite.email) {
    return (
      <div className="space-y-4">
        {intro}
        <p className="text-sm text-stone-600">
          You&apos;re signed in as {user.email}. Sign out, then sign in with{" "}
          {invite.email} to accept.
        </p>
        <SignOutButton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {intro}
      <ActionForm
        action={acceptInviteAction.bind(null, token)}
        submitLabel="Accept invitation"
        pendingLabel="Joining…"
        variant="primary"
      />
    </div>
  );
}
