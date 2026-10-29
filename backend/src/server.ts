import "dotenv/config";
import { createApp } from "./app.js";
import { describeDatabaseUrl, EnvError, loadEnv } from "./config/env.js";
import { createSequelize } from "./db/sequelize.js";

async function main() {
  const env = loadEnv();
  const sequelize = createSequelize(env);

  try {
    await sequelize.authenticate();
    console.log(`Database connected: ${describeDatabaseUrl(env.DATABASE_URL)} (schema "${env.DATABASE_SCHEMA}")`);
  } catch (err) {
    /* Keep serving: /api/health reports the database as unreachable until it recovers */
    console.error(`Database not reachable at startup: ${(err as Error).message}`);
  }

  const app = createApp({
    corsOrigin: env.CORS_ORIGIN,
    checkDatabase: () => sequelize.query("SELECT 1"),
  });
  const server = app.listen(env.PORT, () => console.log(`RPW API listening on http://localhost:${env.PORT}`));

  const shutdown = () => {
    server.close(() => void sequelize.close().finally(() => process.exit(0)));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error(err instanceof EnvError ? err.message : err);
  process.exit(1);
});
