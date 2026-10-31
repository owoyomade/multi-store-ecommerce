"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckboxField, TextField } from "@/components/ui/field";
import { authClient } from "@/lib/auth/auth-client";
import { safeNextPath } from "@/lib/safe-redirect";

export function TwoFactorForm() {
  const router = useRouter();
  const nextPath = safeNextPath(useSearchParams().get("next"));
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const code = String(form.get("code")).replace(/\s/g, "");
    const trustDevice = form.get("trustDevice") === "on";
    setPending(true);
    setError(null);

    const { error: verifyError } = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice });

    if (verifyError) {
      setPending(false);
      setError(
        verifyError.status === 429
          ? "Too many attempts. Please wait a few minutes and try again."
          : verifyError.status === 401
            ? "Your sign-in timed out. Please sign in again."
            : "That code didn't work. Check your app and try again.",
      );
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      <TextField
        // Re-keying clears what was typed when switching code type.
        key={useBackupCode ? "backup" : "app"}
        label={useBackupCode ? "Backup code" : "6-digit code"}
        name="code"
        required
        autoFocus
        autoComplete="one-time-code"
        inputMode={useBackupCode ? "text" : "numeric"}
        hint={
          useBackupCode
            ? "Each backup code works once."
            : "From your authenticator app."
        }
      />
      <CheckboxField
        label="Trust this browser for 30 days"
        name="trustDevice"
      />
      <Button
        type="submit"
        className="w-full"
        pending={pending}
        pendingLabel="Checking…"
      >
        Continue
      </Button>
      <button
        type="button"
        onClick={() => setUseBackupCode((current) => !current)}
        className="text-sm text-stone-600 underline"
      >
        {useBackupCode ? "Use my authenticator app" : "Use a backup code"}
      </button>
    </form>
  );
}
