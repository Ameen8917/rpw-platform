import { describe, expect, it } from "vitest";
import { describeDatabaseUrl, EnvError, loadEnv, testDatabaseUrl } from "./env.js";

const URL_WITH_SECRET = "postgresql://postgres.abc:s3cr3t-pass@aws-0-ap-south-1.pooler.supabase.com:5432/postgres";

describe("loadEnv", () => {
  it("applies defaults when only DATABASE_URL is set", () => {
    const env = loadEnv({ DATABASE_URL: URL_WITH_SECRET });
    expect(env).toMatchObject({
      NODE_ENV: "development", PORT: 4000, CORS_ORIGIN: "http://localhost:5173",
      DATABASE_SCHEMA: "rpw", DATABASE_SSL: true,
    });
    expect(env.DATABASE_SSL_CA_PATH).toBeUndefined();
  });

  it("treats an empty optional value (as left in .env.example) as unset", () => {
    expect(loadEnv({ DATABASE_URL: URL_WITH_SECRET, DATABASE_SSL_CA_PATH: "" }).DATABASE_SSL_CA_PATH).toBeUndefined();
  });

  it("fails fast, naming the missing variable", () => {
    expect(() => loadEnv({})).toThrow(EnvError);
    expect(() => loadEnv({})).toThrow(/DATABASE_URL: is required/);
  });

  it("rejects non-postgres URLs and unsafe schema names", () => {
    expect(() => loadEnv({ DATABASE_URL: "mysql://x" })).toThrow(/DATABASE_URL/);
    expect(() => loadEnv({ DATABASE_URL: URL_WITH_SECRET, DATABASE_SCHEMA: 'rpw"; drop' })).toThrow(/DATABASE_SCHEMA/);
  });

  it("never echoes a value in its error message", () => {
    try {
      loadEnv({ DATABASE_URL: URL_WITH_SECRET, PORT: "not-a-port" });
      expect.unreachable();
    } catch (err) {
      expect((err as Error).message).toMatch(/PORT/);
      expect((err as Error).message).not.toContain("s3cr3t-pass");
    }
  });

  it("parses DATABASE_SSL as a boolean", () => {
    expect(loadEnv({ DATABASE_URL: URL_WITH_SECRET, DATABASE_SSL: "false" }).DATABASE_SSL).toBe(false);
  });
});

describe("testDatabaseUrl", () => {
  const TEST_URL = "postgresql://postgres.xyz:other@aws-0-eu-west-2.pooler.supabase.com:5432/postgres";

  it("returns a separate test database", () => {
    expect(testDatabaseUrl(loadEnv({ DATABASE_URL: URL_WITH_SECRET, TEST_DATABASE_URL: TEST_URL }))).toBe(TEST_URL);
  });

  it("refuses when unset or pointing at the main database, even with a different password", () => {
    expect(() => testDatabaseUrl(loadEnv({ DATABASE_URL: URL_WITH_SECRET }))).toThrow(/not set/);
    const sameDb = URL_WITH_SECRET.replace("s3cr3t-pass", "different");
    expect(() => testDatabaseUrl(loadEnv({ DATABASE_URL: URL_WITH_SECRET, TEST_DATABASE_URL: sameDb }))).toThrow(/same database/);
  });
});

describe("describeDatabaseUrl", () => {
  it("shows host, port and database without credentials", () => {
    const d = describeDatabaseUrl(URL_WITH_SECRET);
    expect(d).toBe("aws-0-ap-south-1.pooler.supabase.com:5432/postgres");
    expect(d).not.toContain("s3cr3t");
  });
});
