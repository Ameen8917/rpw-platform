import "dotenv/config";
import { createApp } from "./app.js";
import { describeDatabaseUrl, EnvError, loadEnv } from "./config/env.js";
import { initModels } from "./db/models.js";
import { createSequelize } from "./db/sequelize.js";
import { createAuthService } from "./modules/auth/auth.service.js";
import { createOrgService } from "./modules/org/org.service.js";

async function main() {
  const env = loadEnv();
  const sequelize = createSequelize(env);
  initModels(sequelize);

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
    auth: createAuthService({ sessionSecret: env.SESSION_SECRET, sessionTtlHours: env.SESSION_TTL_HOURS }),
    org: createOrgService(),
    cookie: { secure: env.NODE_ENV === "production" },
    devLoginEnabled: env.DEV_LOGIN_ENABLED,
  });
  const server = app.listen(env.PORT, () => {
    console.log(`RPW API listening on http://localhost:${env.PORT}`);
    if (env.DEV_LOGIN_ENABLED) console.warn("DEV_LOGIN_ENABLED: anyone reaching this server can sign in as any user.");
  });

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
