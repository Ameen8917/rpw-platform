import { describe, expect, it } from "vitest";
import { describeDatabaseUrl, EnvError, loadEnv, testDatabaseUrl } from "./env.js";

const URL_WITH_SECRET = "postgresql://postgres.abc:s3cr3t-pass@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";
const SESSION_SECRET = "x".repeat(32);
/* Minimal valid environment, plus overrides */
const vars = (o: Record<string, string> = {}) => ({ DATABASE_URL: URL_WITH_SECRET, SESSION_SECRET, ...o });

describe("loadEnv", () => {
  it("applies defaults when only the required variables are set", () => {
    const env = loadEnv(vars());
    expect(env).toMatchObject({
      NODE_ENV: "development", PORT: 4000, CORS_ORIGIN: "http://localhost:5173",
      DATABASE_SCHEMA: "rpw", DATABASE_SSL: true, SESSION_TTL_HOURS: 12, DEV_LOGIN_ENABLED: false,
    });
    expect(env.DATABASE_SSL_CA_PATH).toBeUndefined();
    expect(env.SEED_USER_PASSWORD).toBeUndefined();
  });

  it("treats an empty optional value (as left in .env.example) as unset", () => {
    expect(loadEnv(vars({ DATABASE_SSL_CA_PATH: "", SEED_USER_PASSWORD: "" }))).toMatchObject({
      DATABASE_SSL_CA_PATH: undefined, SEED_USER_PASSWORD: undefined,
    });
  });

  it("fails fast, naming each missing variable once", () => {
    expect(() => loadEnv({})).toThrow(EnvError);
    try {
      loadEnv({});
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg.match(/DATABASE_URL/g)).toHaveLength(1);
      expect(msg).toMatch(/SESSION_SECRET: is required/);
    }
  });

  it("rejects non-postgres URLs, unsafe schema names and short secrets", () => {
    expect(() => loadEnv(vars({ DATABASE_URL: "mysql://x" }))).toThrow(/DATABASE_URL/);
    expect(() => loadEnv(vars({ DATABASE_SCHEMA: 'rpw"; drop' }))).toThrow(/DATABASE_SCHEMA/);
    expect(() => loadEnv(vars({ SESSION_SECRET: "short" }))).toThrow(/SESSION_SECRET: must be at least 32/);
    expect(() => loadEnv(vars({ SEED_USER_PASSWORD: "1234" }))).toThrow(/SEED_USER_PASSWORD/);
  });

  it("refuses development sign-in in production", () => {
    expect(() => loadEnv(vars({ NODE_ENV: "production", DEV_LOGIN_ENABLED: "true" }))).toThrow(/DEV_LOGIN_ENABLED: must not be true in production/);
    expect(loadEnv(vars({ DEV_LOGIN_ENABLED: "true" })).DEV_LOGIN_ENABLED).toBe(true);
  });

  it("never echoes a value in its error message", () => {
    try {
      loadEnv(vars({ PORT: "not-a-port", SESSION_SECRET: "tiny-secret" }));
      expect.unreachable();
    } catch (err) {
      const msg = (err as Error).message;
      expect(msg).toMatch(/PORT/);
      expect(msg).not.toContain("s3cr3t-pass");
      expect(msg).not.toContain("tiny-secret");
    }
  });

  it("parses DATABASE_SSL as a boolean", () => {
    expect(loadEnv(vars({ DATABASE_SSL: "false" })).DATABASE_SSL).toBe(false);
  });
});

describe("testDatabaseUrl", () => {
  const TEST_URL = "postgresql://postgres.xyz:other@aws-0-eu-west-2.pooler.supabase.com:5432/postgres";

  it("returns a separate test database", () => {
    expect(testDatabaseUrl(loadEnv(vars({ TEST_DATABASE_URL: TEST_URL })))).toBe(TEST_URL);
  });

  it("refuses when unset or pointing at the main database, even with a different password", () => {
    expect(() => testDatabaseUrl(loadEnv(vars()))).toThrow(/not set/);
    const sameDb = URL_WITH_SECRET.replace("s3cr3t-pass", "different");
    expect(() => testDatabaseUrl(loadEnv(vars({ TEST_DATABASE_URL: sameDb })))).toThrow(/same database/);
  });
});

describe("describeDatabaseUrl", () => {
  it("shows host, port and database without credentials", () => {
    const d = describeDatabaseUrl(URL_WITH_SECRET);
    expect(d).toBe("aws-0-ap-south-1.pooler.supabase.com:5432/postgres");
    expect(d).not.toContain("s3cr3t");
  });
});
