import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` throws when imported outside Next.js's server bundle.
      // Tests run in plain Node, which is a server, so swap in an empty module.
      "server-only": fileURLToPath(
        new URL("./tests/support/empty-module.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    setupFiles: ["tests/support/setup-env.ts"],
    // Integration tests share one test database, so run files one at a time
    // to stop one file's cleanup from deleting another file's rows.
    fileParallelism: false,
    // Integration tests talk to a real database; 5 seconds (the default) is
    // too tight on a busy laptop or a shared CI machine.
    testTimeout: 15_000,
  },
});
