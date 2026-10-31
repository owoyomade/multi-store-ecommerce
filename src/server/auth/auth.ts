import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { db } from "../db";
import { env } from "../env";
import { sendEmail } from "../email/mailer";
import { resetPasswordMessage, verifyEmailMessage } from "../email/templates";

export const auth = betterAuth({
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    // Unverified accounts cannot sign in, so nobody can create a store with
    // someone else's email address.
    requireEmailVerification: true,
    minPasswordLength: 10,
    // A password reset logs out every other device, in case the account was compromised.
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(resetPasswordMessage(user.email, url));
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(verifyEmailMessage(user.email, url));
    },
  },

  user: {
    additionalFields: {
      // `input: false` means sign-up requests cannot set this field, so nobody
      // can make themselves a platform admin.
      platformRole: { type: "string", defaultValue: "USER", input: false },
    },
  },

  // Limits repeated sign-in / sign-up / reset attempts per IP address. The
  // counters live in Postgres (the rate_limits table) so they survive restarts
  // and are shared between servers.
  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
    storage: "database",
  },

  plugins: [
    // Optional sign-in codes from an authenticator app, with one-time backup
    // codes. Repeated wrong codes lock the account for a while.
    twoFactor({ issuer: "Storefront Studio" }),
    // Must be the last plugin: it lets server actions set the session cookie.
    nextCookies(),
  ],
});
