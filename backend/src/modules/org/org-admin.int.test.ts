import request from "supertest";
import type { Sequelize } from "sequelize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { createApp } from "../../app.js";
import { createTestApp, sessionCookie, signIn } from "../../test/test-app.js";
import { openTestDatabase, testDbEnv } from "../../test/test-db.js";
import { LIMIT_DEFAULTS } from "../settings/settings.schemas.js";

const env = testDbEnv();

/* Seeded people. Everything here works on records these tests create (a "Test Motors"
   dealership, its people and department), so seeded authority stays as other files expect. */
const DIRECTOR = "RPW-EMP-0001";   // U_ARJ
const IT_HEAD = "RPW-EMP-0012";    // U_SUNIL: admin_console grant
const HR_MANAGER = "RPW-EMP-0121"; // U_ANI: no admin rights

describe.skipIf(!env)("Admin console and group settings (test database)", () => {
  let sequelize: Sequelize;
  let app: ReturnType<typeof createApp>;
  const as: Record<string, string> = {};
  const get = (who: string, path: string) => request(app).get(path).set("Cookie", as[who]);
  const send = (method: "post" | "patch" | "put", who: string, path: string, body: object) =>
    request(app)[method](path).set("Cookie", as[who]).send(body);

  beforeAll(async () => {
    sequelize = openTestDatabase(env!);
    app = createTestApp(sequelize);
    for (const code of [DIRECTOR, IT_HEAD, HR_MANAGER]) as[code] = await signIn(app, code);
  });
  afterAll(async () => {
    /* Leave the group limits as the other files expect them */
    if (as[DIRECTOR]) await send("put", DIRECTOR, "/api/settings", LIMIT_DEFAULTS);
    await sequelize?.close();
  });

  describe("master data", () => {
    it("is for the Director and those granted the Admin console", async () => {
      expect((await send("post", HR_MANAGER, "/api/org/facilities", { dealershipId: "D_MTB", name: "X", type: "Sales outlet", district: "Beed" })).status).toBe(403);
      expect((await send("patch", HR_MANAGER, "/api/org/facilities/F12", { active: false })).status).toBe(403);
    });

    it("adds a dealership with its short code as ID, once", async () => {
      const body = { name: "Test Motors", short: "tmx", brand: "Test", code: "TMX-01", headId: "U_VIJ", territory: ["Beed"] };
      const res = await send("post", IT_HEAD, "/api/org/dealerships", body);
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: "D_TMX", short: "TMX", name: "Test Motors", brand: "Test", code: "TMX-01", headId: "U_VIJ", territory: ["Beed"], active: true });
      expect((await send("post", IT_HEAD, "/api/org/dealerships", body)).status).toBe(409);
      expect((await send("post", IT_HEAD, "/api/org/dealerships", { ...body, short: "TMY", code: "TMY-01", headId: "U_ANI" })).body.error.details[0].path).toBe("headId");
      expect((await get(HR_MANAGER, "/api/audit")).status).toBe(403);
      expect((await get(DIRECTOR, "/api/audit?ref=TMX-01")).body[0]).toMatchObject({ actorId: "U_SUNIL", action: "Created dealership", detail: "Test Motors · Test" });
    });

    it("adds and deactivates a location", async () => {
      const res = await send("post", IT_HEAD, "/api/org/facilities", { dealershipId: "D_TMX", name: "Beed Showroom", type: "Sales outlet", district: "Beed" });
      expect(res.status).toBe(201);
      expect(res.body.id).toMatch(/^F_[A-Z0-9]{6}$/);
      const off = await send("patch", IT_HEAD, `/api/org/facilities/${res.body.id}`, { active: false });
      expect(off.body).toMatchObject({ id: res.body.id, active: false });
      expect((await send("post", IT_HEAD, "/api/org/facilities", { dealershipId: "D_NOPE", name: "X", type: "Sales outlet", district: "Beed" })).status).toBe(400);
      expect((await send("patch", IT_HEAD, "/api/org/facilities/F_NOPE", { active: false })).status).toBe(404);
    });

    it("adds a department; dual authority needs a functional head", async () => {
      expect((await send("post", IT_HEAD, "/api/org/departments", { name: "Test Facilities", dualAuthority: true })).status).toBe(400);
      expect((await send("post", IT_HEAD, "/api/org/departments", { name: "Test Facilities", dualAuthority: true, functionalHeadId: "U_VIJ" })).status).toBe(400);
      const res = await send("post", IT_HEAD, "/api/org/departments", { name: "Test Facilities", dualAuthority: true, functionalHeadId: "U_PARESH" });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: "Test Facilities", dualAuthority: true, functionalHeadId: "U_PARESH", active: true });
      expect((await send("post", IT_HEAD, "/api/org/departments", { name: "Test Facilities", dualAuthority: false })).status).toBe(409);
    });
  });

  describe("people and authority", () => {
    let leaverId: string;

    it("adds a person with a login who can then sign in", async () => {
      const person = { name: "Test Leaver", empCode: "TMX-EMP-001", title: "Manager", dealershipId: "D_TMX", deptId: "DEP_ADM", role: "manager" };
      expect((await send("post", IT_HEAD, "/api/org/users", { ...person, password: "short" })).body.error.details[0].path).toBe("password");
      const res = await send("post", IT_HEAD, "/api/org/users", { ...person, password: "Leaver-Password-1" });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ empCode: "TMX-EMP-001", role: "manager", dealershipIds: ["D_TMX"], deptId: "DEP_ADM", grants: [] });
      expect(res.body).not.toHaveProperty("noLogin");
      leaverId = res.body.id;
      expect((await send("post", IT_HEAD, "/api/org/users", { ...person, empCode: "tmx-emp-001", password: "Leaver-Password-1" })).status).toBe(409);

      const login = await request(app).post("/api/auth/login").send({ empCode: "TMX-EMP-001", password: "Leaver-Password-1" });
      expect(login.status).toBe(200);
      as.leaver = sessionCookie(login)!;
    });

    it("only lets the Director make a Director", async () => {
      const director = { name: "Test Director", empCode: "TMX-EMP-009", dealershipId: "D_TMX", role: "director", password: "Director-Password-1" };
      expect((await send("post", IT_HEAD, "/api/org/users", director)).status).toBe(403);
      expect((await send("patch", IT_HEAD, "/api/org/users/U_ARJ", { role: "staff", dealershipIds: ["D_CORP"] })).status).toBe(403);
    });

    it("imports a pasted list of staff, all or nothing", async () => {
      const people = [{ name: "Test Staff A", empCode: "TMX-EMP-101" }, { name: "Test Staff B", empCode: "TMX-EMP-102", title: "Driver" }];
      expect((await send("post", IT_HEAD, "/api/org/users/bulk", { dealershipId: "D_TMX", people: [...people, { name: "Dup", empCode: "RPW-EMP-0001" }] })).status).toBe(409);
      const res = await send("post", IT_HEAD, "/api/org/users/bulk", { dealershipId: "D_TMX", people });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject([{ role: "staff", noLogin: true, title: "—" }, { empCode: "TMX-EMP-102", title: "Driver" }]);
    });

    it("changes role, scope and approval limit", async () => {
      const res = await send("patch", IT_HEAD, `/api/org/users/${leaverId}`, { role: "functional_head", deptId: "DEP_ADM", dealershipIds: ["D_TMX", "D_MTB"], approvalLimit: 25000 });
      expect(res.body).toMatchObject({ role: "functional_head", dealershipIds: ["D_MTB", "D_TMX"], approvalLimit: 25000 });
      expect((await get(DIRECTOR, "/api/audit?ref=TMX-EMP-001")).body[0]).toMatchObject({
        action: "Changed authority", detail: "Test Leaver → Corporate functional head · limit ₹25,000",
      });
    });

    it("hands a role over: headships move, the leaver loses access at once", async () => {
      const dept = (await send("post", IT_HEAD, "/api/org/departments", { name: "Test Handover", dualAuthority: true, functionalHeadId: leaverId })).body;
      const successor = (await send("post", IT_HEAD, "/api/org/users", {
        name: "Test Successor", empCode: "TMX-EMP-002", dealershipId: "D_TMX", role: "manager", password: "Successor-Password-1",
      })).body;
      expect((await get("leaver", "/api/auth/me")).status).toBe(200);

      expect((await send("post", IT_HEAD, `/api/org/users/${leaverId}/handover`, { successorId: leaverId, revoke: true })).status).toBe(400);
      const res = await send("post", IT_HEAD, `/api/org/users/${leaverId}/handover`, { successorId: successor.id, revoke: true });
      expect(res.status).toBe(200);
      expect(res.body.successor).toMatchObject({ role: "functional_head", deptId: "DEP_ADM", dealershipIds: ["D_MTB", "D_TMX"], approvalLimit: 25000 });
      expect(res.body.leaver).toMatchObject({ role: "staff", noLogin: true, inactive: true, approvalLimit: null });
      const departments = (await get(DIRECTOR, "/api/org/departments")).body as { id: string; functionalHeadId: string }[];
      expect(departments.find((d) => d.id === dept.id)!.functionalHeadId).toBe(successor.id);
      expect((await get("leaver", "/api/auth/me")).status).toBe(401);
      expect((await request(app).post("/api/auth/login").send({ empCode: "TMX-EMP-001", password: "Leaver-Password-1" })).status).toBe(401);
    });
  });

  describe("group settings", () => {
    it("are readable by everyone and changed only through the Admin console", async () => {
      expect((await get(HR_MANAGER, "/api/settings")).body).toEqual(LIMIT_DEFAULTS);
      expect((await send("put", HR_MANAGER, "/api/settings", LIMIT_DEFAULTS)).status).toBe(403);
      expect((await send("put", IT_HEAD, "/api/settings", { ...LIMIT_DEFAULTS, slaDays: 0 })).status).toBe(400);
      const res = await send("put", IT_HEAD, "/api/settings", { ...LIMIT_DEFAULTS, capitalisation: 10000 });
      expect(res.body.capitalisation).toBe(10000);
      expect((await get(DIRECTOR, "/api/audit?ref=group")).body[0]).toMatchObject({ actorId: "U_SUNIL", action: "Updated authority rules" });
    });

    it("move the capitalisation floor for accessories", async () => {
      const asset = await send("post", IT_HEAD, "/api/assets", { category: "Furniture & Fixtures", name: "Test Desk", cost: 20000, dealershipId: "D_TMX" });
      expect(asset.status).toBe(201);
      const add = (cost: number) => send("post", IT_HEAD, `/api/assets/${asset.body.id}/accessories`, { name: "Lamp", origin: "separate", cost });
      expect((await add(7000)).status).toBe(201);
      await send("put", IT_HEAD, "/api/settings", LIMIT_DEFAULTS);
      const refused = await add(7000);
      expect(refused.status).toBe(400);
      expect(refused.body.error.details[0]).toMatchObject({ path: "cost", message: expect.stringMatching(/₹5,000 capitalisation floor/) });
    });
  });
});
