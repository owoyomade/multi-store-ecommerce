"use client";

import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { authClient } from "@/lib/auth/auth-client";

type Status = "idle" | "pending" | "sent" | "error";

export function ForgotPasswordForm() {
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setStatus("pending");

    const { error } = await authClient.requestPasswordReset({
      email: String(form.get("email")),
      redirectTo: "/reset-password",
    });
    setStatus(error ? "error" : "sent");
  }

  if (status === "sent") {
    // Shown whether or not the email has an account, so this page can't be used
    // to discover who is registered.
    return (
      <Alert tone="success">
        If that email has an account, a reset link is on its way.
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {status === "error" && (
        <Alert tone="error">
          Something went wrong. Please try again in a moment.
        </Alert>
      )}
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <Button
        type="submit"
        className="w-full"
        pending={status === "pending"}
        pendingLabel="Sending…"
      >
        Send reset link
      </Button>
    </form>
  );
}
