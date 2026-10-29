import { describe, expect, it } from "vitest";
import { createThrottle } from "./login-throttle.js";
import { hashPassword, verifyAgainstDummy, verifyPassword } from "./password.js";
import { permissionsFor } from "./permissions.js";
import { readSessionCookie } from "./session-cookie.js";

describe("password hashing", () => {
  it("verifies the right password and rejects others", async () => {
    const h = await hashPassword("correct horse");
    expect(h).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(await verifyPassword("correct horse", h)).toBe(true);
    expect(await verifyPassword("correct horsE", h)).toBe(false);
  });

  it("salts each hash", async () => {
    expect(await hashPassword("same")).not.toBe(await hashPassword("same"));
  });

  it("rejects malformed stored values without throwing", async () => {
    expect(await verifyPassword("x", "plaintext")).toBe(false);
    expect(await verifyAgainstDummy("x")).toBe(false);
  });
});

describe("login throttle", () => {
  it("blocks after maxFailures within the window, then releases", () => {
    let t = 0;
    const th = createThrottle({ maxFailures: 3, windowMs: 60_000, now: () => t });
    th.fail("k"); th.fail("k");
    expect(th.retryAfter("k")).toBe(0);
    th.fail("k");
    expect(th.retryAfter("k")).toBe(60);
    t = 30_000;
    expect(th.retryAfter("k")).toBe(30);
    t = 60_001;
    expect(th.retryAfter("k")).toBe(0);
  });

  it("is per key and can be reset", () => {
    const th = createThrottle({ maxFailures: 1, windowMs: 60_000 });
    th.fail("a");
    expect(th.retryAfter("a")).toBeGreaterThan(0);
    expect(th.retryAfter("b")).toBe(0);
    th.reset("a");
    expect(th.retryAfter("a")).toBe(0);
  });
});

describe("permissionsFor", () => {
  const user = (role: Parameters<typeof permissionsFor>[0]["role"], extra: Partial<Parameters<typeof permissionsFor>[0]> = {}) =>
    permissionsFor({ role, deptId: null, grants: [], ...extra });

  it("derives asset powers from role", () => {
    expect(user("director")).toMatchObject({ canAddExisting: true, canDispose: true, canAdminConsole: true, isDirector: true });
    expect(user("functional_head")).toMatchObject({ canAddExisting: true, canDispose: false, canSeeAudit: true });
    expect(user("business_head")).toMatchObject({ canAddExisting: false, canDispose: false, isBH: true });
    expect(user("manager")).toMatchObject({ canAddExisting: false, canRaise: true });
  });

  it("takes person-specific powers from grants, not user IDs", () => {
    const gmFinance = user("functional_head", { deptId: "DEP_ACC", grants: ["finance_signoff", "dispose_assets"] });
    expect(gmFinance).toMatchObject({ isGMFinance: true, canFinanceSignoff: true, canDispose: true, canSeePayments: true });
    expect(user("functional_head", { grants: ["admin_console"] }).canAdminConsole).toBe(true);
    expect(user("functional_head").canAdminConsole).toBe(false);
  });

  it("gives dealership accounts managers advance approval", () => {
    expect(user("manager", { deptId: "DEP_ACC" }).canApproveAdvance).toBe(true);
    expect(user("manager", { deptId: "DEP_IT" }).canApproveAdvance).toBe(false);
  });
});

describe("readSessionCookie", () => {
  const req = (cookie?: string) => ({ headers: { cookie } }) as Parameters<typeof readSessionCookie>[0];
  it("finds our cookie among others", () => {
    expect(readSessionCookie(req("a=1; rpw_session=abc-_123; b=2"))).toBe("abc-_123");
    expect(readSessionCookie(req("rpw_sessionx=nope"))).toBeNull();
    expect(readSessionCookie(req())).toBeNull();
  });
});
