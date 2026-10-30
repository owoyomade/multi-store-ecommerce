import type { StoreRole } from "@/generated/prisma/enums";

// Every action a staff member can take in a store dashboard. Server code checks
// these (never the role name directly), so changing what a role may do only
// means editing the map below.
export type Permission =
  | "store:view"
  | "store:settings"
  | "staff:manage"
  | "catalog:edit"
  | "inventory:adjust"
  | "orders:view"
  | "orders:fulfill"
  | "orders:refund"
  | "discounts:manage"
  | "reports:view";

const ROLE_PERMISSIONS: Record<StoreRole, readonly Permission[]> = {
  OWNER: [
    "store:view",
    "store:settings",
    "staff:manage",
    "catalog:edit",
    "inventory:adjust",
    "orders:view",
    "orders:fulfill",
    "orders:refund",
    "discounts:manage",
    "reports:view",
  ],
  // Runs the store day to day, but cannot change settings or who has access.
  MANAGER: [
    "store:view",
    "catalog:edit",
    "inventory:adjust",
    "orders:view",
    "orders:fulfill",
    "orders:refund",
    "discounts:manage",
    "reports:view",
  ],
  INVENTORY_EDITOR: ["store:view", "catalog:edit", "inventory:adjust"],
  FULFILLMENT_AGENT: ["store:view", "orders:view", "orders:fulfill"],
};

export function roleHasPermission(
  role: StoreRole,
  permission: Permission,
): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export const ROLE_LABELS: Record<StoreRole, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  INVENTORY_EDITOR: "Inventory editor",
  FULFILLMENT_AGENT: "Fulfillment agent",
};
