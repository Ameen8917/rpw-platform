/* Runs a command against the test project instead of the live one, for testing by hand:
   TEST_DATABASE_URL (refused if it is the main database), schema rpw_uat (integration tests
   rebuild rpw_test, which would wipe a manual test run), and a separate Storage bucket.
   dotenv does not overwrite variables already set, so the command keeps these values. */
import "dotenv/config";
import { spawn } from "node:child_process";
import { describeDatabaseUrl, EnvError, loadEnv, testDatabaseUrl } from "../config/env.js";

const UAT_SCHEMA = "rpw_uat";
const UAT_BUCKET = "rpw-files-test";

function main() {
  const command = process.argv.slice(2).join(" ");
  if (!command) throw new EnvError("Usage: with-test-db.ts <command>");
  const env = loadEnv();
  if (env.NODE_ENV === "production") throw new EnvError("Refused when NODE_ENV=production.");
  const url = testDatabaseUrl(env);
  console.log(`TEST DATABASE: ${describeDatabaseUrl(url)}, schema "${UAT_SCHEMA}", bucket "${UAT_BUCKET}"`);

  const child = spawn(command, {
    shell: true, stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, DATABASE_SCHEMA: UAT_SCHEMA, SUPABASE_STORAGE_BUCKET: UAT_BUCKET, DEV_LOGIN_ENABLED: "true" },
  });
  child.on("exit", (code) => { process.exitCode = code ?? 1; });
}

try {
  main();
} catch (err) {
  console.error(err instanceof EnvError ? err.message : err);
  process.exitCode = 1;
}
