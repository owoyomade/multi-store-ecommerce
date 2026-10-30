import { config } from "dotenv";

// Load .env, then point the app at the test database so tests can never
// touch development data.
config({ quiet: true });
if (!process.env.TEST_DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL is not set. Copy .env.example to .env first.",
  );
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

// Uploaded test images go to a throwaway folder, not the real storage directory.
process.env.STORAGE_DIR = `${process.env.TMPDIR ?? "/tmp"}/multi-store-test-storage`;
