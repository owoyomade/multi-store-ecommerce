import "server-only";
import { z } from "zod";

// Validates environment variables once at startup so a missing value fails
// loudly with a clear message instead of causing a confusing error later.
const envSchema = z.object({
  DATABASE_URL: z.url(),
  APP_URL: z.url(),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().min(1),
});

export const env = envSchema.parse(process.env);
