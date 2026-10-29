/* npm run db:check — confirms the backend can reach the Supabase database.
   Read-only: runs SELECT queries and changes nothing. Never prints the password. */
import "dotenv/config";
import { describeDatabaseUrl, EnvError, loadEnv, testDatabaseUrl } from "../config/env.js";
import { createSequelize } from "../db/sequelize.js";

/* Plain-language hints for the failures people actually hit with Supabase */
function hint(message: string): string | null {
  if (/ENOTFOUND|getaddrinfo/i.test(message)) {
    return "Host not found. If you used the 'Direct connection' string (db.<ref>.supabase.co), it is IPv6-only — use the 'Session pooler' string instead.";
  }
  if (/password authentication failed/i.test(message)) {
    return "Wrong password, or the user is not 'postgres.<project-ref>' as the pooler requires. Reset the database password in Supabase if unsure.";
  }
  if (/Tenant or user not found/i.test(message)) {
    return "The pooler did not recognise the project. Check the user part is 'postgres.<project-ref>' and the region in the host is right.";
  }
  if (/ETIMEDOUT|ECONNREFUSED|timeout/i.test(message)) {
    return "Could not open a connection. Check the port (5432 for session pooler), your network/firewall, and that the project is not paused.";
  }
  if (/self[- ]signed certificate|unable to verify|certificate/i.test(message)) {
    return "Certificate check failed. Check DATABASE_SSL_CA_PATH points to the CA certificate downloaded from Supabase, or leave it empty.";
  }
  if (/max client connections|too many clients/i.test(message)) {
    return "Connection limit reached. Stop other running servers or scripts using this database and retry.";
  }
  return null;
}

async function main() {
  const env = loadEnv();
  /* --test checks the integration-test database instead of the main one */
  const url = process.argv.includes("--test") ? testDatabaseUrl(env) : env.DATABASE_URL;
  console.log(`Checking ${describeDatabaseUrl(url)}${url === env.DATABASE_URL ? "" : " (test database)"} ...`);

  const sequelize = createSequelize({ ...env, DATABASE_URL: url });
  try {
    const started = Date.now();
    await sequelize.authenticate();
    const connectMs = Date.now() - started;

    /* TLS as seen from our side of the socket. pg_stat_ssl would describe the Supabase
       pooler's own link to Postgres, not this connection. */
    const client = (await sequelize.connectionManager.getConnection({ type: "read" })) as unknown as {
      connection: { stream: { encrypted?: boolean; getProtocol?: () => string | null } };
    };
    const stream = client.connection.stream;
    const tls = stream.encrypted ? `TLS (${stream.getProtocol?.() ?? "unknown version"})` : "NONE — connection is not encrypted";
    sequelize.connectionManager.releaseConnection(client as never);

    const queryStarted = Date.now();
    const [[info]] = (await sequelize.query(
      "SELECT current_database() AS database, version() AS version",
    )) as [Record<string, unknown>[], unknown];
    const queryMs = Date.now() - queryStarted;
    const [[schema]] = (await sequelize.query(
      "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = :schema) AS present",
      { replacements: { schema: env.DATABASE_SCHEMA } },
    )) as [Record<string, unknown>[], unknown];

    console.log("Connected.");
    console.log(`  database     ${info.database}`);
    console.log(`  server       ${String(info.version).split(",")[0]}`);
    console.log(`  encryption   ${tls}${stream.encrypted ? (env.DATABASE_SSL_CA_PATH ? ", certificate verified" : ", certificate not verified") : ""}`);
    console.log(`  connect      ${connectMs} ms (includes TLS handshake)`);
    console.log(`  query        ${queryMs} ms round trip`);
    console.log(`  schema       "${env.DATABASE_SCHEMA}" ${schema.present ? "exists" : "not created yet — run npm run db:migrate"}`);
  } catch (err) {
    const message = (err as Error).message;
    console.error(`Connection failed: ${message}`);
    const h = hint(message);
    if (h) console.error(`Hint: ${h}`);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main().catch((err) => {
  console.error(err instanceof EnvError ? err.message : err);
  process.exitCode = 1;
});
