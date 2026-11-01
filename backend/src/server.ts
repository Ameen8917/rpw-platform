import "dotenv/config";
import { createApp } from "./app.js";
import { describeDatabaseUrl, EnvError, loadEnv } from "./config/env.js";
import { initModels } from "./db/models.js";
import { createSequelize } from "./db/sequelize.js";
import { createAssetService } from "./modules/assets/assets.service.js";
import { createAttachmentService } from "./modules/assets/attachments.service.js";
import { createCustodyService } from "./modules/assets/custody.service.js";
import { createAuditService } from "./modules/audit/audit.service.js";
import { createFilesService } from "./modules/files/files.service.js";
import { createSupabaseStorage, createUnconfiguredStorage } from "./modules/files/storage.js";
import { createAuthService } from "./modules/auth/auth.service.js";
import { createClaudeInvoiceReader } from "./modules/invoices/invoice-reader.js";
import { createInvoiceService } from "./modules/invoices/invoices.service.js";
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

  const storage = env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseStorage({ url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY, bucket: env.SUPABASE_STORAGE_BUCKET })
    : createUnconfiguredStorage();
  if (!env.SUPABASE_URL) console.warn("Supabase Storage is not configured: saving signatures and attachments will answer 503 (docs/supabase-setup.md).");
  const files = createFilesService({ storage, bucket: env.SUPABASE_STORAGE_BUCKET });
  const assets = createAssetService({ files });
  const invoiceReader = env.ANTHROPIC_API_KEY ? createClaudeInvoiceReader({ apiKey: env.ANTHROPIC_API_KEY, model: env.INVOICE_AI_MODEL }) : null;
  console.log(invoiceReader
    ? `Invoice reading: AI reading on (${env.INVOICE_AI_MODEL}, ${env.INVOICE_AI_HOURLY_LIMIT} per person per hour).`
    : "Invoice reading: AI reading off (no ANTHROPIC_API_KEY); invoices are entered by hand.");

  const app = createApp({
    corsOrigin: env.CORS_ORIGIN,
    checkDatabase: () => sequelize.query("SELECT 1"),
    auth: createAuthService({ sessionSecret: env.SESSION_SECRET, sessionTtlHours: env.SESSION_TTL_HOURS }),
    org: createOrgService(),
    assets,
    custody: createCustodyService({ assets, files }),
    attachments: createAttachmentService({ assets, files }),
    audit: createAuditService(),
    invoices: createInvoiceService({ reader: invoiceReader, hourlyLimit: env.INVOICE_AI_HOURLY_LIMIT }),
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
