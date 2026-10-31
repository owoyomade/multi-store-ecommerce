import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// Browser-side helper that calls our own /api/auth/* routes. Going through the
// HTTP routes (rather than calling Better Auth from server actions) means every
// sign-in attempt passes Better Auth's rate limiter and origin check.
// The sign-in form handles the "now enter your code" step itself, so the
// plugin's automatic redirect isn't used.
export const authClient = createAuthClient({ plugins: [twoFactorClient()] });
