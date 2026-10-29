import dotenv from "dotenv";
import { loadEnv, testDatabaseUrl, type Env } from "../config/env.js";
import { createMigrator } from "../db/migrator.js";
import { initModels } from "../db/models.js";
import { createSequelize } from "../db/sequelize.js";
import { seedOrg } from "../db/seed/seed-org.js";

/* Integration tests run against TEST_DATABASE_URL (a separate Supabase project), in their own
   schema. testDatabaseUrl() refuses if that URL is missing or points at the main database. */
export const TEST_SCHEMA = "rpw_test";
export const TEST_PASSWORD = "Test-Password-123!";
export const TEST_SESSION_SECRET = "test-session-secret-at-least-32-characters-long";

dotenv.config();

/** Connection settings for the test database, or null when integration tests are not configured */
export function testDbEnv(): Env | null {
  if (!process.env.TEST_DATABASE_URL) return null;
  const env = loadEnv({ ...process.env, SESSION_SECRET: TEST_SESSION_SECRET });
  return { ...env, DATABASE_URL: testDatabaseUrl(env), DATABASE_SCHEMA: TEST_SCHEMA };
}

/* Drops and rebuilds the test schema from migrations, then seeds. Destructive by design — and
   only ever against the test database, in the rpw_test schema. */
export async function resetTestDatabase(env: Env) {
  if (env.DATABASE_SCHEMA !== TEST_SCHEMA) throw new Error(`Refusing to reset schema "${env.DATABASE_SCHEMA}"`);
  const sequelize = createSequelize(env);
  initModels(sequelize);
  try {
    await sequelize.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
    await sequelize.query(`CREATE SCHEMA "${TEST_SCHEMA}"`);
    await createMigrator(sequelize, TEST_SCHEMA).up();
    await seedOrg(sequelize, { initialPassword: TEST_PASSWORD });
  } finally {
    await sequelize.close();
  }
}

/** A connected Sequelize with models, for one test file */
export function openTestDatabase(env: Env) {
  const sequelize = createSequelize(env);
  initModels(sequelize);
  return sequelize;
}
