"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { authClient } from "@/lib/auth/auth-client";

type ResetState =
  | { status: "idle" | "pending" | "done" }
  | { status: "error"; message: string };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, setState] = useState<ResetState>({ status: "idle" });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("password"));
    if (newPassword !== String(form.get("confirmPassword"))) {
      setState({ status: "error", message: "The two passwords don't match." });
      return;
    }

    setState({ status: "pending" });
    const { error } = await authClient.resetPassword({ newPassword, token });
    setState(
      error
        ? {
            status: "error",
            message:
              error.message ?? "This reset link is invalid or has expired.",
          }
        : { status: "done" },
    );
  }

  if (state.status === "done") {
    return (
      <div className="space-y-4">
        <Alert tone="success">
          Your password has been changed. You&apos;ve been signed out on other
          devices.
        </Alert>
        <Link href="/sign-in" className="text-sm font-medium underline">
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {state.status === "error" && <Alert tone="error">{state.message}</Alert>}
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={10}
        hint="At least 10 characters."
      />
      <TextField
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
      />
      <Button
        type="submit"
        className="w-full"
        pending={state.status === "pending"}
        pendingLabel="Saving…"
      >
        Save new password
      </Button>
    </form>
  );
}
