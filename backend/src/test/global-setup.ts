import { describeDatabaseUrl } from "../config/env.js";
import { resetTestDatabase, testDbEnv } from "./test-db.js";

/* Runs once before all test files: rebuilds the integration-test schema, or explains why
   integration tests will be skipped. */
export default async function setup() {
  const env = testDbEnv();
  if (!env) {
    console.warn("\n⚠ TEST_DATABASE_URL not set — database integration tests are SKIPPED.\n");
    return;
  }
  const started = Date.now();
  await resetTestDatabase(env);
  console.log(`\nTest database ready: ${describeDatabaseUrl(env.DATABASE_URL)}, schema "${env.DATABASE_SCHEMA}" (${Date.now() - started} ms)\n`);
}
