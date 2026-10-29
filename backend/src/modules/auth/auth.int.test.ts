import request from "supertest";
import type { Sequelize } from "sequelize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { openTestDatabase, TEST_PASSWORD, TEST_SESSION_SECRET, testDbEnv } from "../../test/test-db.js";
import { createOrgService } from "../org/org.service.js";
import { createThrottle } from "./login-throttle.js";
import { createAuthService } from "./auth.service.js";
import { Session } from "./session.model.js";

const env = testDbEnv();

/* Seeded people (prototype data) */
const DIRECTOR = "RPW-EMP-0001";   // Arjun, U_ARJ, D_CORP
const IT_MANAGER = "RPW-EMP-0187"; // Nilesh Jadhav, U_NIL, JCB Nashik
const STAFF = "RPW-EMP-0421";      // Ganesh Shinde, no login

const sessionCookie = (res: request.Response) =>
  ([] as string[]).concat(res.headers["set-cookie"] ?? []).find((c) => c.startsWith("rpw_session="));

describe.skipIf(!env)("auth and org API (test database)", () => {
  let sequelize: Sequelize;
  let app: ReturnType<typeof createApp>;
  const authOpts = { sessionSecret: TEST_SESSION_SECRET, sessionTtlHours: 12 };

  beforeAll(() => {
    sequelize = openTestDatabase(env!);
    app = createApp({
      corsOrigin: "http://localhost:5173",
      checkDatabase: () => sequelize.query("SELECT 1"),
      auth: createAuthService({
        ...authOpts,
        accountThrottle: createThrottle({ maxFailures: 3, windowMs: 60_000 }),
        ipThrottle: createThrottle({ maxFailures: 1000, windowMs: 60_000 }),
      }),
      org: createOrgService(),
      cookie: { secure: false },
      devLoginEnabled: true,
    });
  });
  afterAll(() => sequelize?.close());

  const login = (empCode: string, password = TEST_PASSWORD) =>
    request(app).post("/api/auth/login").send({ empCode, password });

  describe("sign-in", () => {
    it("signs in with employee code (any case) and sets a locked-down session cookie", async () => {
      const res = await login(DIRECTOR.toLowerCase());
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: "U_ARJ", role: "director", dealershipIds: ["D_CORP"] });
      expect(res.body.permissions).toMatchObject({ isDirector: true, canAddExisting: true, canDispose: true });
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);

      const cookie = sessionCookie(res)!;
      expect(cookie).toMatch(/HttpOnly/);
      expect(cookie).toMatch(/SameSite=Strict/);
      expect(cookie).toMatch(/Path=\/api/);
    });

    it("rejects a wrong password and an unknown code with the same message", async () => {
      const wrong = await login(IT_MANAGER, "not-the-password");
      const unknown = await login("RPW-EMP-9999");
      expect(wrong.status).toBe(401);
      expect(unknown.status).toBe(401);
      expect(wrong.body).toEqual(unknown.body);
      expect(wrong.body.error.code).toBe("invalid_credentials");
    });

    it("never signs in staff without a login, even with the seed password", async () => {
      expect((await login(STAFF)).status).toBe(401);
    });

    it("treats % and _ literally, not as wildcards", async () => {
      expect((await login("RPW-EMP-000%")).status).toBe(401);
      expect((await login("RPW-EMP-000_")).status).toBe(401);
    });

    it("validates the request body", async () => {
      const res = await request(app).post("/api/auth/login").send({ empCode: DIRECTOR });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("validation_error");
    });

    it("blocks an account after repeated failures, even with the right password", async () => {
      const code = "RPW-EMP-0012"; // Sunil Raut
      for (let i = 0; i < 3; i++) expect((await login(code, "wrong")).status).toBe(401);
      const blocked = await login(code);
      expect(blocked.status).toBe(429);
      expect(Number(blocked.headers["retry-after"])).toBeGreaterThan(0);
      /* other accounts are unaffected */
      expect((await login(IT_MANAGER)).status).toBe(200);
    });
  });

  describe("sessions", () => {
    it("serves /me from the cookie and ends the session on logout", async () => {
      const cookie = sessionCookie(await login(IT_MANAGER))!;
      const me = await request(app).get("/api/auth/me").set("Cookie", cookie);
      expect(me.status).toBe(200);
      expect(me.body.user).toMatchObject({ id: "U_NIL", dealershipIds: ["D_JCB_NSK"] });
      expect(me.body.permissions).toMatchObject({ isManager: true, canAddExisting: false });

      expect((await request(app).post("/api/auth/logout").set("Cookie", cookie)).status).toBe(204);
      expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
    });

    it("stores only a keyed hash of the token", async () => {
      const cookie = sessionCookie(await login(DIRECTOR))!;
      const token = decodeURIComponent(cookie.split(";")[0].split("=")[1]);
      expect(await Session.count({ where: { idHash: token } })).toBe(0);
      const rows = await Session.findAll({ where: { userId: "U_ARJ" } });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r) => /^[0-9a-f]{64}$/.test(r.idHash))).toBe(true);
    });

    it("expires sessions after the TTL", async () => {
      const res = await login(DIRECTOR);
      const token = decodeURIComponent(sessionCookie(res)!.split(";")[0].split("=")[1]);
      const later = createAuthService({ ...authOpts, now: () => new Date(Date.now() + 13 * 3_600_000) });
      expect(await later.resolve(token)).toBeNull();
    });

    it("rejects a forged cookie", async () => {
      expect((await request(app).get("/api/auth/me").set("Cookie", "rpw_session=forged")).status).toBe(401);
    });
  });

  describe("organisation endpoints", () => {
    let cookie: string;
    beforeAll(async () => { cookie = sessionCookie(await login(IT_MANAGER))!; });
    const get = (path: string) => request(app).get(`/api/org/${path}`).set("Cookie", cookie);

    it("returns the seeded organisation", async () => {
      const [d, f, dep, u] = await Promise.all([get("dealerships"), get("facilities"), get("departments"), get("users")]);
      expect([d.status, f.status, dep.status, u.status]).toEqual([200, 200, 200, 200]);
      expect([d.body.length, f.body.length, dep.body.length, u.body.length]).toEqual([8, 16, 9, 23]);
      expect(d.body.find((x: { id: string }) => x.id === "D_CORP")).toMatchObject({ isCorporate: true, headId: "U_ARJ" });
      expect(dep.body.find((x: { id: string }) => x.id === "DEP_IT")).toMatchObject({ dualAuthority: true, functionalHeadId: "U_SUNIL" });
    });

    it("shapes users like the frontend expects, without password fields", async () => {
      const users = (await get("users")).body as Record<string, unknown>[];
      expect(JSON.stringify(users)).not.toMatch(/password/i);
      expect(users.find((x) => x.id === "S_001")).toMatchObject({ noLogin: true, role: "staff" });
      expect(users.find((x) => x.id === "U_VIS")).toMatchObject({ dealershipIds: ["D_CL", "D_HMSI"] });
      expect(users.find((x) => x.id === "U_SUJAY")).toMatchObject({ grants: ["finance_signoff", "dispose_assets"] });
    });
  });

  describe("development sign-in", () => {
    it("lists only people who can sign in", async () => {
      const res = await request(app).get("/api/auth/dev/users");
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(19);
      expect(res.body.some((u: { id: string }) => u.id.startsWith("S_"))).toBe(false);
    });

    it("signs in as a chosen user, but never as staff without a login", async () => {
      const ok = await request(app).post("/api/auth/dev/login-as").send({ userId: "U_SAM" });
      expect(ok.status).toBe(200);
      expect(ok.body.user).toMatchObject({ id: "U_SAM", role: "business_head" });
      expect((await request(app).post("/api/auth/dev/login-as").send({ userId: "S_001" })).status).toBe(404);
    });
  });
});
