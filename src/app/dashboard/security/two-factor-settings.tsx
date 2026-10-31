"use client";

import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { authClient } from "@/lib/auth/auth-client";

type Setup = { qrDataUrl: string; secret: string; backupCodes: string[] };

/** The secret inside an otpauth:// link, for people who can't scan the QR code. */
function secretFromUri(totpUri: string): string {
  return new URL(totpUri).searchParams.get("secret") ?? "";
}

function passwordError(status: number): string {
  return status === 429
    ? "Too many attempts. Please wait a minute."
    : "That password isn't right.";
}

export function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  return enabled ? <ManageTwoFactor /> : <EnableTwoFactor />;
}

function EnableTwoFactor() {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password"));
    setPending(true);
    setError(null);
    const { data, error: enableError } = await authClient.twoFactor.enable({
      password,
    });
    // We only offer authenticator apps, so the response is always the TOTP kind.
    if (enableError || !data || data.method !== "totp") {
      setPending(false);
      setError(passwordError(enableError?.status ?? 400));
      return;
    }
    setSetup({
      qrDataUrl: await QRCode.toDataURL(data.totpURI, {
        margin: 1,
        width: 200,
      }),
      secret: secretFromUri(data.totpURI),
      backupCodes: data.backupCodes,
    });
    setPending(false);
  }

  // Two-step sign-in only switches on once a code from the app proves the
  // app was set up correctly, so nobody gets locked out by a bad scan.
  async function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = String(new FormData(event.currentTarget).get("code")).replace(
      /\s/g,
      "",
    );
    setPending(true);
    setError(null);
    const { error: verifyError } = await authClient.twoFactor.verifyTotp({
      code,
    });
    if (verifyError) {
      setPending(false);
      setError("That code didn't match. Check the app and try again.");
      return;
    }
    router.refresh();
  }

  if (!setup) {
    return (
      <form onSubmit={start} className="space-y-4">
        {error && <Alert tone="error">{error}</Alert>}
        <TextField
          label="Confirm your password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        <Button type="submit" pending={pending} pendingLabel="Starting…">
          Set up authenticator app
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      {error && <Alert tone="error">{error}</Alert>}
      <ol className="list-decimal space-y-6 pl-5 text-sm">
        <li className="space-y-3">
          <p>
            Scan this code with an authenticator app such as Google
            Authenticator, 1Password or Authy.
          </p>
          {/* A data: URL made in the browser, so the secret never leaves this page. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={setup.qrDataUrl}
            alt="QR code for your authenticator app"
            width={200}
            height={200}
            className="rounded-md border border-stone-200"
          />
          <p className="text-stone-600">
            Can&apos;t scan it? Enter this key instead:{" "}
            <code className="font-mono break-all text-stone-900">
              {setup.secret}
            </code>
          </p>
        </li>
        <li className="space-y-3">
          <p>
            Save these backup codes somewhere safe. Each one signs you in once
            if you lose your phone. They won&apos;t be shown again.
          </p>
          <ul className="grid grid-cols-2 gap-1 rounded-md bg-stone-100 p-3 font-mono text-sm">
            {setup.backupCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </li>
        <li>
          <form onSubmit={confirm} className="space-y-3">
            <TextField
              label="Enter the 6-digit code from the app"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
            <Button type="submit" pending={pending} pendingLabel="Checking…">
              Turn on two-step sign-in
            </Button>
          </form>
        </li>
      </ol>
    </div>
  );
}

function ManageTwoFactor() {
  const router = useRouter();
  const [newCodes, setNewCodes] = useState<string[] | null>(null);
  const [pending, setPending] = useState<"codes" | "disable" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password"));
    // The submit button that was clicked says which action is wanted.
    const intent =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
      "disable"
        ? "disable"
        : "codes";
    setPending(intent);
    setError(null);

    if (intent === "codes") {
      const { data, error: codesError } =
        await authClient.twoFactor.generateBackupCodes({ password });
      setPending(null);
      if (codesError || !data)
        setError(passwordError(codesError?.status ?? 400));
      else setNewCodes(data.backupCodes);
      return;
    }
    const { error: disableError } = await authClient.twoFactor.disable({
      password,
    });
    setPending(null);
    if (disableError) setError(passwordError(disableError.status));
    else router.refresh();
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      {error && <Alert tone="error">{error}</Alert>}
      {newCodes && (
        <div className="space-y-2 text-sm">
          <p>Your new backup codes (the old ones no longer work):</p>
          <ul className="grid grid-cols-2 gap-1 rounded-md bg-stone-100 p-3 font-mono">
            {newCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
        </div>
      )}
      <TextField
        label="Confirm your password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          value="codes"
          variant="secondary"
          pending={pending === "codes"}
          pendingLabel="Creating…"
        >
          New backup codes
        </Button>
        <Button
          type="submit"
          value="disable"
          variant="secondary"
          pending={pending === "disable"}
          pendingLabel="Turning off…"
        >
          Turn off two-step sign-in
        </Button>
      </div>
    </form>
  );
}
