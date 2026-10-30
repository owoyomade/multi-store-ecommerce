import { randomUUID } from "node:crypto";
import type { StoreRole } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import type { CreateStoreInput } from "@/lib/validation/store";

/** Empties every table between tests. CASCADE follows foreign keys. */
export async function resetDatabase(): Promise<void> {
  const tables = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const tableList = tables
    .map(({ tablename }) => `"public"."${tablename}"`)
    .join(", ");
  await db.$executeRawUnsafe(`TRUNCATE TABLE ${tableList} CASCADE`);
}

export async function createUser(name: string) {
  return db.user.create({
    data: {
      id: randomUUID(),
      name,
      email: `${name.toLowerCase().replaceAll(" ", ".")}@example.test`,
      emailVerified: true,
    },
  });
}

export function storeInput(
  overrides: Partial<CreateStoreInput> = {},
): CreateStoreInput {
  return {
    name: "Test Store",
    slug: "test-store",
    currency: "CAD",
    country: "CA",
    contactEmail: "hello@example.test",
    primaryColor: "#1f2937",
    accentColor: "#f59e0b",
    ...overrides,
  };
}

export async function addMember(
  storeId: string,
  userId: string,
  role: StoreRole,
) {
  return db.storeMembership.create({ data: { storeId, userId, role } });
}
