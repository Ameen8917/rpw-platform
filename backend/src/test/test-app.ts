import request from "supertest";
import type { Sequelize } from "sequelize";
import { createApp, type AppDeps } from "../app.js";
import { createAssetService } from "../modules/assets/assets.service.js";
import { createAuditService } from "../modules/audit/audit.service.js";
import { createAuthService } from "../modules/auth/auth.service.js";
import { createOrgService } from "../modules/org/org.service.js";
import { TEST_PASSWORD, TEST_SESSION_SECRET } from "./test-db.js";

export const TEST_AUTH_OPTIONS = { sessionSecret: TEST_SESSION_SECRET, sessionTtlHours: 12 };

/** The real app against the test database, with development sign-in on; override any dependency */
export function createTestApp(sequelize: Sequelize, overrides: Partial<AppDeps> = {}) {
  return createApp({
    corsOrigin: "http://localhost:5173",
    checkDatabase: () => sequelize.query("SELECT 1"),
    auth: createAuthService(TEST_AUTH_OPTIONS),
    org: createOrgService(),
    assets: createAssetService(),
    audit: createAuditService(),
    cookie: { secure: false },
    devLoginEnabled: true,
    ...overrides,
  });
}

export const sessionCookie = (res: request.Response) =>
  ([] as string[]).concat(res.headers["set-cookie"] ?? []).find((c) => c.startsWith("rpw_session="));

/** Signs in with the seed password and returns the session cookie */
export async function signIn(app: ReturnType<typeof createApp>, empCode: string) {
  const res = await request(app).post("/api/auth/login").send({ empCode, password: TEST_PASSWORD });
  if (res.status !== 200) throw new Error(`Sign-in as ${empCode} failed: ${res.status}`);
  return sessionCookie(res)!;
}
