import { execSync } from "node:child_process";
import { config } from "dotenv";

// Runs once before all tests: applies migrations to the test database.
export default function setup() {
  config({ quiet: true });
  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (!testDatabaseUrl) {
    throw new Error(
      "TEST_DATABASE_URL is not set. Copy .env.example to .env first.",
    );
  }
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: "pipe",
  });
}
