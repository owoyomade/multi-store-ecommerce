// Creates demo data: a platform admin, two independent stores with catalogs,
// and a staff member who works in both with different roles. Safe to run more
// than once.
//
// Run with: npm run db:seed
// (The seed command passes --conditions=react-server so this script may import
// app modules marked "server-only", which it is: it runs on the server.)
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { PlatformRole, StoreRole } from "../src/generated/prisma/enums";
import { db } from "../src/server/db";
import { lumenCatalog, northbrewCatalog, seedCatalog } from "./seed-catalog";
import {
  lumenStorefront,
  northbrewStorefront,
  seedStorefront,
} from "./seed-storefront";

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
  theme: "CLASSIC" | "BOLD";
  tagline: string;
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
    // Keep the demo look current on re-runs without touching anything else.
    update: { theme: storeData.theme, tagline: storeData.tagline },
    create: {
      ...storeData,
      status: "ACTIVE",
      settings: { create: settings },
      inventoryLocations: {
        create: { name: "Main warehouse", isDefault: true },
      },
    },
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
      theme: "CLASSIC",
      tagline: "Small-batch coffee, roasted in Toronto.",
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
      theme: "BOLD",
      tagline: "Everyday essentials. Made to last.",
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

  console.log("Seeding catalogs…");
  await seedCatalog("northbrew", maya.id, northbrewCatalog);
  await seedCatalog("lumen", theo.id, lumenCatalog);
  await seedStorefront("northbrew", maya.id, northbrewStorefront);
  await seedStorefront("lumen", theo.id, lumenStorefront);

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
