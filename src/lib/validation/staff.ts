import { z } from "zod";

export const STORE_ROLES = [
  "OWNER",
  "MANAGER",
  "INVENTORY_EDITOR",
  "FULFILLMENT_AGENT",
] as const;

const storeRoleSchema = z.string().pipe(z.enum(STORE_ROLES, "Choose a role"));

export const staffInviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address")),
  role: storeRoleSchema,
});

export const roleChangeSchema = z.object({ role: storeRoleSchema });

export type StaffInviteInput = z.input<typeof staffInviteSchema>;
