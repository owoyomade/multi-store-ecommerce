import { createAuthClient } from "better-auth/react";

// Browser-side helper that calls our own /api/auth/* routes. Going through the
// HTTP routes (rather than calling Better Auth from server actions) means every
// sign-in attempt passes Better Auth's rate limiter and origin check.
export const authClient = createAuthClient();
