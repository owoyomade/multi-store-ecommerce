import { execSync } from "node:child_process";
import { e2eEnvironment } from "../playwright.config";

// Brings the test database up to date and loads the demo stores, so the
// accessibility checks have real pages to look at.
export default function globalSetup() {
  const env = { ...process.env, ...e2eEnvironment };
  execSync("npx prisma migrate deploy", { env, stdio: "pipe" });
  execSync("npx prisma db seed", { env, stdio: "pipe" });
}
