import { describe, expect, it } from "vitest";
import { roleHasPermission } from "@/server/permissions/roles";

describe("roleHasPermission", () => {
  it("lets owners do everything, including managing staff and settings", () => {
    expect(roleHasPermission("OWNER", "staff:manage")).toBe(true);
    expect(roleHasPermission("OWNER", "store:settings")).toBe(true);
    expect(roleHasPermission("OWNER", "orders:refund")).toBe(true);
  });

  it("stops managers from changing settings or staff", () => {
    expect(roleHasPermission("MANAGER", "orders:refund")).toBe(true);
    expect(roleHasPermission("MANAGER", "store:settings")).toBe(false);
    expect(roleHasPermission("MANAGER", "staff:manage")).toBe(false);
  });

  it("limits inventory editors to catalog and stock", () => {
    expect(roleHasPermission("INVENTORY_EDITOR", "inventory:adjust")).toBe(
      true,
    );
    expect(roleHasPermission("INVENTORY_EDITOR", "orders:view")).toBe(false);
  });

  it("lets fulfillment agents ship orders but not refund or edit products", () => {
    expect(roleHasPermission("FULFILLMENT_AGENT", "orders:fulfill")).toBe(true);
    expect(roleHasPermission("FULFILLMENT_AGENT", "orders:refund")).toBe(false);
    expect(roleHasPermission("FULFILLMENT_AGENT", "catalog:edit")).toBe(false);
  });
});
