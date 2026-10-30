// Creates demo data: a platform admin, two independent stores and a staff
// member who works in both with different roles. Safe to run more than once.
//
// Run with: npm run db:seed
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import type { PlatformRole, StoreRole } from "../src/generated/prisma/enums";

// The seed runs outside Next.js, so it builds its own client instead of
// importing src/server/db.ts (which is marked server-only).
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const demoPassword = process.env.SEED_DEMO_PASSWORD;
if (!demoPassword || demoPassword.length < 10) {
  throw new Error(
    "Set SEED_DEMO_PASSWORD (at least 10 characters) in .env before seeding.",
  );
}

async function upsertUser(
  name: string,
  email: string,
  platformRole: PlatformRole = "USER",
) {
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return existing;

  // Better Auth stores the password hash on a "credential" account row whose
  // accountId is the user's own ID, hashed the same way it hashes at sign-up.
  const userId = randomUUID();
  return db.user.create({
    data: {
      id: userId,
      name,
      email,
      emailVerified: true,
      platformRole,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          password: await hashPassword(demoPassword as string),
        },
      },
    },
  });
}

type DemoStore = {
  name: string;
  slug: string;
  currency: string;
  country: string;
  contactEmail: string;
  primaryColor: string;
  accentColor: string;
  settings: {
    demoTaxRateBps: number;
    flatShippingCents: number;
    freeShippingOverCents: number;
  };
};

async function upsertStore(
  store: DemoStore,
  members: { userId: string; role: StoreRole }[],
) {
  const { settings, ...storeData } = store;
  const saved = await db.store.upsert({
    where: { slug: store.slug },
    update: {},
    create: { ...storeData, status: "ACTIVE", settings: { create: settings } },
  });

  for (const member of members) {
    await db.storeMembership.upsert({
      where: { storeId_userId: { storeId: saved.id, userId: member.userId } },
      update: { role: member.role },
      create: { storeId: saved.id, ...member },
    });
  }
  return saved;
}

async function main() {
  const admin = await upsertUser(
    "Platform Admin",
    "admin@example.test",
    "SUPER_ADMIN",
  );
  const maya = await upsertUser("Maya Okafor", "maya@northbrew.example.test");
  const theo = await upsertUser("Theo Lindqvist", "theo@lumen.example.test");
  const sam = await upsertUser("Sam Rivera", "sam@example.test");

  await upsertStore(
    {
      name: "Northbrew Coffee",
      slug: "northbrew",
      currency: "CAD",
      country: "CA",
      contactEmail: "hello@northbrew.example.test",
      primaryColor: "#3b2416",
      accentColor: "#d97706",
      // 13% matches Ontario HST — a demo value, not tax advice.
      settings: {
        demoTaxRateBps: 1300,
        flatShippingCents: 900,
        freeShippingOverCents: 7500,
      },
    },
    [
      { userId: maya.id, role: "OWNER" },
      { userId: sam.id, role: "MANAGER" },
    ],
  );

  await upsertStore(
    {
      name: "Lumen Studio Apparel",
      slug: "lumen",
      currency: "USD",
      country: "US",
      contactEmail: "support@lumen.example.test",
      primaryColor: "#0f172a",
      accentColor: "#e11d48",
      settings: {
        demoTaxRateBps: 800,
        flatShippingCents: 600,
        freeShippingOverCents: 10000,
      },
    },
    [
      { userId: theo.id, role: "OWNER" },
      { userId: sam.id, role: "FULFILLMENT_AGENT" },
    ],
  );

  console.log("Seeded demo data:");
  console.table([
    { email: admin.email, access: "Platform admin" },
    { email: maya.email, access: "Owner of Northbrew Coffee" },
    { email: theo.email, access: "Owner of Lumen Studio Apparel" },
    {
      email: sam.email,
      access: "Manager at Northbrew, Fulfillment agent at Lumen",
    },
  ]);
  console.log(
    "All demo accounts use the password in SEED_DEMO_PASSWORD (.env).",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
