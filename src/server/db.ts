import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

// In development Next.js reloads modules on every edit. Keeping the client on
// `globalThis` stops each reload from opening a new pool of database connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  return new PrismaClient({
    adapter,
    // Hosted, every query is a network round trip to the database, so a
    // transaction with many steps (a product with dozens of variants) can
    // outlast Prisma's 5-second default. 15 seconds is the ceiling, not the
    // usual time; locks are still released the moment a transaction ends.
    transactionOptions: { timeout: 15_000, maxWait: 10_000 },
  });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
