import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// API routes against a real Postgres (TEST_DATABASE_URL, wiped on every run).
// Auth, Redis, Traccar and the alert cache are replaced in src/test/integration/mocks.ts.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.int.test.ts"],
    globalSetup: ["src/test/integration/global-setup.ts"],
    setupFiles: ["src/test/integration/mocks.ts"],
    // One database: test files run one after another
    fileParallelism: false,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      // No road matching: distances come from the GPS fixes
      OSRM_URL: "",
    },
  },
});
