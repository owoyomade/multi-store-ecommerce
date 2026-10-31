import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct connection. Neon's pooled address (used by the
    // running app as DATABASE_URL) can't hold the locks migrations take, so
    // hosted setups also set DIRECT_URL. Locally the two are the same.
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
