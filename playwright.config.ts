import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ quiet: true });

// The browser tests run a production build of the app on its own port,
// against the test database, with the stand-in payment provider instead of
// Stripe. Nothing here touches development data.
const PORT = 3211;
export const E2E_APP_URL = `http://localhost:${PORT}`;

const e2eEnvironment = {
  DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
  APP_URL: E2E_APP_URL,
  E2E_FAKE_PAYMENTS: "1",
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
  STORAGE_DIR: `${process.env.TMPDIR ?? "/tmp"}/multi-store-e2e-storage`,
};

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // One shared database, so tests run one after another.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: E2E_APP_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI has already built the app in an earlier step, so it skips rebuilding.
    command: `${process.env.E2E_SKIP_BUILD ? "" : "npm run build && "}npx next start -p ${PORT}`,
    url: `${E2E_APP_URL}/api/health`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: e2eEnvironment,
  },
});

export { e2eEnvironment };
