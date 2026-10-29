/* npm run db:seed — loads the prototype's dealerships, facilities, departments and people.
   Re-runnable. Users who can sign in get SEED_USER_PASSWORD only if they have no password yet. */
import "dotenv/config";
import { describeDatabaseUrl, EnvError, loadEnv } from "../config/env.js";
import { initModels } from "../db/models.js";
import { createSequelize } from "../db/sequelize.js";
import { seedOrg } from "../db/seed/seed-org.js";

async function main() {
  const env = loadEnv();
  if (env.NODE_ENV === "production") throw new EnvError("db:seed loads development data and is refused when NODE_ENV=production.");
  if (!env.SEED_USER_PASSWORD) throw new EnvError("SEED_USER_PASSWORD is not set (backend/.env).");

  const sequelize = createSequelize(env);
  initModels(sequelize);
  try {
    console.log(`Seeding ${describeDatabaseUrl(env.DATABASE_URL)}, schema "${env.DATABASE_SCHEMA}" ...`);
    const r = await seedOrg(sequelize, { initialPassword: env.SEED_USER_PASSWORD });
    console.log(`Upserted ${r.dealerships} dealerships, ${r.facilities} facilities, ${r.departments} departments, ${r.users} people.`);
    console.log(`Initial password set for ${r.passwordsSet} user(s)${r.passwordsSet ? "" : " (everyone already had one)"}.`);
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error(err instanceof EnvError ? err.message : err);
  process.exitCode = 1;
});
