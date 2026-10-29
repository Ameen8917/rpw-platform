import { readFileSync } from "node:fs";
import { Sequelize } from "sequelize";
import type { Env } from "../config/env.js";

type DbConfig = Pick<Env, "DATABASE_URL" | "DATABASE_SCHEMA" | "DATABASE_SSL" | "DATABASE_SSL_CA_PATH">;

/* Supabase requires TLS. With a CA certificate the server's certificate is verified;
   without one the connection is still encrypted but not verified. */
function sslOptions(config: DbConfig) {
  if (!config.DATABASE_SSL) return false;
  if (config.DATABASE_SSL_CA_PATH) {
    return { ca: readFileSync(config.DATABASE_SSL_CA_PATH, "utf8"), rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

export function createSequelize(config: DbConfig): Sequelize {
  return new Sequelize(config.DATABASE_URL, {
    dialect: "postgres",
    logging: false,
    dialectOptions: { ssl: sslOptions(config) },
    /* Small pool: Supabase's pooler limits client connections per project */
    pool: { max: 5, min: 0, idle: 10_000, acquire: 20_000 },
    define: {
      schema: config.DATABASE_SCHEMA,
      underscored: true,
      timestamps: true,
    },
  });
}

/* Schema name is validated in env.ts, so quoting it as an identifier is safe */
export async function ensureSchema(sequelize: Sequelize, schema: string): Promise<void> {
  await sequelize.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
}
