import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    /* Rebuilds the test schema once; integration tests are skipped if TEST_DATABASE_URL is unset */
    globalSetup: ["src/test/global-setup.ts"],
    /* Integration tests talk to Supabase over the network (~150 ms per query) */
    testTimeout: 30_000,
    hookTimeout: 60_000,
    /* Test files share one test database; run them one at a time */
    fileParallelism: false,
  },
});
