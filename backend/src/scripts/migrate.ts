/* npm run db:migrate          — create the schema if missing, then apply pending migrations
   npm run db:migrate:status   — list applied and pending migrations (applies nothing)
   There is deliberately no "down" command: reverting a migration can drop data and needs a
   conscious decision, not a script shortcut. */
import "dotenv/config";
import { describeDatabaseUrl, EnvError, loadEnv } from "../config/env.js";
import { createMigrator } from "../db/migrator.js";
import { createSequelize, ensureSchema } from "../db/sequelize.js";

async function main() {
  const command = process.argv[2];
  if (command !== "up" && command !== "status") throw new Error("Usage: migrate.ts up|status");

  const env = loadEnv();
  const sequelize = createSequelize(env);
  try {
    console.log(`Database ${describeDatabaseUrl(env.DATABASE_URL)}, schema "${env.DATABASE_SCHEMA}"`);
    const migrator = createMigrator(sequelize, env.DATABASE_SCHEMA);

    if (command === "status") {
      const [[schema]] = (await sequelize.query(
        "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = :schema) AS present",
        { replacements: { schema: env.DATABASE_SCHEMA } },
      )) as [Record<string, unknown>[], unknown];
      if (!schema.present) {
        console.log("Schema not created yet, so nothing is applied. Run npm run db:migrate.");
        return;
      }
      const [executed, pending] = await Promise.all([migrator.executed(), migrator.pending()]);
      console.log(`Applied (${executed.length}): ${executed.map((m) => m.name).join(", ") || "none"}`);
      console.log(`Pending (${pending.length}): ${pending.map((m) => m.name).join(", ") || "none"}`);
      return;
    }

    await ensureSchema(sequelize, env.DATABASE_SCHEMA);
    const applied = await migrator.up();
    console.log(applied.length ? `Applied: ${applied.map((m) => m.name).join(", ")}` : "Already up to date.");
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error(err instanceof EnvError ? err.message : err);
  process.exitCode = 1;
});
