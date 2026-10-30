"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { authClient } from "@/lib/auth/auth-client";
import { safeNextPath } from "@/lib/safe-redirect";

export function SignInForm() {
  const router = useRouter();
  const nextPath = safeNextPath(useSearchParams().get("next"));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    const { error: signInError } = await authClient.signIn.email({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });

    if (signInError) {
      setPending(false);
      setError(signInErrorMessage(signInError.code, signInError.status));
      return;
    }
    // refresh() makes server components re-read the new session cookie.
    router.push(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <Button
        type="submit"
        className="w-full"
        pending={pending}
        pendingLabel="Signing in…"
      >
        Sign in
      </Button>
    </form>
  );
}

// The same message for "no such user" and "wrong password", so the form
// doesn't reveal which email addresses have accounts.
function signInErrorMessage(code: string | undefined, status: number): string {
  if (code === "EMAIL_NOT_VERIFIED") {
    return "Please verify your email first. We've sent you a new link.";
  }
  if (status === 429) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  return "Email or password is incorrect.";
}
