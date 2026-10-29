import { z } from "zod";

/* Every environment variable the backend reads, validated once at startup.
   Error messages name the variable but never echo its value. */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGIN: z.string().url().default("http://localhost:5173"),

  DATABASE_URL: z
    .string({ required_error: "is required" })
    .min(1, "is required")
    .refine((v) => v === "" || /^postgres(ql)?:\/\//.test(v),"must be a postgres:// or postgresql:// connection string"),
  /* Used as an SQL identifier, so restricted to a safe pattern */
  DATABASE_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]*$/, "must be lowercase letters, digits or underscores").default("rpw"),
  DATABASE_SSL: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  DATABASE_SSL_CA_PATH: z.string().optional().transform((v) => (v ? v : undefined)),

  /* Separate database for integration tests; never the main one */
  TEST_DATABASE_URL: z.string().optional().transform((v) => (v ? v : undefined)),

  /* Keys session lookups (HMAC of the cookie token), so a leaked sessions table cannot be replayed */
  SESSION_SECRET: z.string({ required_error: "is required" }).min(32, "must be at least 32 characters"),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(24 * 30).default(12),
  /* Initial password for seeded users who can sign in (db:seed only) */
  SEED_USER_PASSWORD: z.string().min(8, "must be at least 8 characters").optional().or(z.literal("").transform(() => undefined)),
  /* "Sign in as" without a password, for development. Refused in production. */
  DEV_LOGIN_ENABLED: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
}).superRefine((env, ctx) => {
  if (env.NODE_ENV === "production" && env.DEV_LOGIN_ENABLED) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["DEV_LOGIN_ENABLED"], message: "must not be true in production" });
  }
});

export type Env = z.infer<typeof EnvSchema>;

export class EnvError extends Error {}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new EnvError(`Invalid environment configuration:\n${lines.join("\n")}\nSee backend/.env.example.`);
  }
  return parsed.data;
}

/* The test database URL, guaranteed to be set and to differ from the main database */
export function testDatabaseUrl(env: Env): string {
  if (!env.TEST_DATABASE_URL) {
    throw new EnvError("TEST_DATABASE_URL is not set. Point it at a separate Supabase project (docs/supabase-setup.md, section 6).");
  }
  if (!/^postgres(ql)?:\/\//.test(env.TEST_DATABASE_URL)) {
    throw new EnvError("TEST_DATABASE_URL must be a postgres:// or postgresql:// connection string.");
  }
  const target = (u: string) => { const x = new URL(u); return `${x.username}@${x.hostname}:${x.port}${x.pathname}`; };
  if (target(env.TEST_DATABASE_URL) === target(env.DATABASE_URL)) {
    throw new EnvError("TEST_DATABASE_URL points at the same database as DATABASE_URL. Tests delete data, so they need their own project.");
  }
  return env.TEST_DATABASE_URL;
}

/* Host, port and database name for logs — never the user or password */
export function describeDatabaseUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || "5432"}${u.pathname}`;
  } catch {
    return "(unparseable DATABASE_URL)";
  }
}
