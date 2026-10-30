"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { authClient } from "@/lib/auth/auth-client";

export function SignUpForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);

    const { error: signUpError } = await authClient.signUp.email({
      name: String(form.get("name")),
      email: String(form.get("email")),
      password: String(form.get("password")),
      // Where the verification link sends the user once their email is confirmed.
      callbackURL: "/dashboard",
    });

    setPending(false);
    if (signUpError) {
      setError(
        signUpError.message ??
          "We couldn't create your account. Please try again.",
      );
      return;
    }
    router.push("/check-email");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <TextField
        label="Your name"
        name="name"
        autoComplete="name"
        required
        minLength={2}
      />
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
        autoComplete="new-password"
        required
        minLength={10}
        hint="At least 10 characters."
      />
      <Button
        type="submit"
        className="w-full"
        pending={pending}
        pendingLabel="Creating account…"
      >
        Create account
      </Button>
    </form>
  );
}
