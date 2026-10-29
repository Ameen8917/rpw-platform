import request from "supertest";
import type { Sequelize } from "sequelize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { createApp } from "../../app.js";
import { SEED_ASSETS } from "../../db/seed/asset-data.js";
import { TINY_PNG } from "../../test/fixtures.js";
import { createTestApp, signIn } from "../../test/test-app.js";
import { openTestDatabase, testDbEnv } from "../../test/test-db.js";
import { createMemoryStorage, createUnconfiguredStorage } from "../files/storage.js";

const env = testDbEnv();

/* Seeded people. These tests work in Mahindra Chikalthana (D_MAH_CHK) so other test files'
   expectations are not disturbed. */
const IT_HEAD = "RPW-EMP-0012";   // U_SUNIL: issues and receives returns
const BH_MCH = "RPW-EMP-0031";    // U_RAJ: Business Head, Mahindra Chikalthana
const BH_HMSI = "RPW-EMP-0034";   // U_VIS: Business Head elsewhere
const HR_MANAGER = "RPW-EMP-0121"; // U_ANI (Anita Rane): holder with a login
const ACCOUNTS = "RPW-EMP-0133";  // U_SWA: same dealership, not the holder
const STAFF = "S_003";            // Pooja Deshpande: no login, Mahindra Chikalthana

describe.skipIf(!env)("custody API (test database)", () => {
  let sequelize: Sequelize;
  let app: ReturnType<typeof createApp>;
  const storage = createMemoryStorage();
  const as: Record<string, string> = {};
  const get = (who: string, path: string) => request(app).get(path).set("Cookie", as[who]);
  const post = (who: string, path: string, body: object = {}) => request(app).post(path).set("Cookie", as[who]).send(body);

  const addAsset = async (name: string) => {
    const res = await post(IT_HEAD, "/api/assets", {
      category: "Office Equipment", name, cost: 25000, dealershipId: "D_MAH_CHK", facilityId: "F08", bundled: ["Charger"],
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  };

  beforeAll(async () => {
    sequelize = openTestDatabase(env!);
    app = createTestApp(sequelize, {}, storage);
    for (const code of [IT_HEAD, BH_MCH, BH_HMSI, HR_MANAGER, ACCOUNTS]) as[code] = await signIn(app, code);
  });
  afterAll(() => sequelize?.close());

  describe("issue → accept in app → return", () => {
    let id: string;
    beforeAll(async () => { id = await addAsset("Custody Printer"); });

    it("issues for in-app acceptance, freezing the item list on the server", async () => {
      const res = await post(IT_HEAD, `/api/assets/${id}/issue`, { userId: "U_ANI", method: "in_app", note: "For HR desk" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ assignedTo: "U_ANI", issuedBy: "U_SUNIL", acceptance: null, returnRecord: null });
      expect(res.body.custodyHistory[0]).toMatchObject({
        kind: "issue", holderId: "U_ANI", actorId: "U_SUNIL", method: "in_app", snapshot: ["Custody Printer", "Charger"], note: "For HR desk",
      });
      expect(res.body.activity[0]).toMatchObject({
        actorId: "U_SUNIL", action: "Issued asset — acceptance pending", detail: "Anita Rane (RPW-EMP-0121) · 2 item(s)",
      });
    });

    it("cannot be issued again until returned", async () => {
      const res = await post(IT_HEAD, `/api/assets/${id}/issue`, { userId: "U_SWA", method: "in_app" });
      expect(res.status).toBe(409);
    });

    it("is accepted only by the holder, once", async () => {
      expect((await post(ACCOUNTS, `/api/assets/${id}/accept`)).status).toBe(403);
      const res = await post(HR_MANAGER, `/api/assets/${id}/accept`);
      expect(res.status).toBe(200);
      expect(res.body.acceptance).toMatchObject({ method: "in_app", snapshot: ["Custody Printer", "Charger"], signature: null, note: "For HR desk" });
      expect(res.body.activity[0]).toMatchObject({ actorId: "U_ANI", action: "Asset receipt accepted", detail: "Anita Rane confirmed 2 item(s) in app" });
      expect((await post(HR_MANAGER, `/api/assets/${id}/accept`)).status).toBe(409);
    });

    it("records a return only by those who issue, against the handover list", async () => {
      const ret = { condition: "Minor damage", missing: ["Charger"], signature: TINY_PNG };
      expect((await post(HR_MANAGER, `/api/assets/${id}/return`, ret)).status).toBe(403);
      const unknown = await post(IT_HEAD, `/api/assets/${id}/return`, { ...ret, missing: ["Mouse"] });
      expect(unknown.status).toBe(400);
      expect(unknown.body.error.details[0].path).toBe("missing");
      expect((await post(IT_HEAD, `/api/assets/${id}/return`, { ...ret, signature: undefined })).status).toBe(400);

      const before = storage.objects.size;
      const res = await post(IT_HEAD, `/api/assets/${id}/return`, ret);
      expect(res.status).toBe(200);
      expect(storage.objects.size).toBe(before + 1);
      expect(res.body).toMatchObject({
        assignedTo: null, acceptance: null,
        returnRecord: { from: "U_ANI", receivedBy: "U_SUNIL", condition: "Minor damage", missing: ["Charger"] },
      });
      expect(res.body.returnRecord.signature).toMatch(/^memory:\/\/signed\/signatures\/\d{4}\/\d{2}\/[0-9a-f-]+\.png$/);
      expect(res.body.custodyHistory.map((e: { kind: string }) => e.kind)).toEqual(["return", "accept", "issue"]);
      expect(res.body.activity[0]).toMatchObject({ action: "Asset returned", detail: "From Anita Rane · Minor damage · not returned: Charger" });

      expect((await post(IT_HEAD, `/api/assets/${id}/return`, ret)).status).toBe(409);
    });
  });

  describe("handover by signature", () => {
    let id: string;
    beforeAll(async () => { id = await addAsset("Custody Scanner"); });

    it("requires a signature for staff without a login", async () => {
      const res = await post(IT_HEAD, `/api/assets/${id}/issue`, { userId: STAFF, method: "in_app" });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0].path).toBe("method");
      expect((await post(IT_HEAD, `/api/assets/${id}/issue`, { userId: STAFF, method: "signature" })).status).toBe(400);
    });

    it("rejects a signature that is not a real PNG, storing nothing", async () => {
      const before = storage.objects.size;
      const res = await post(IT_HEAD, `/api/assets/${id}/issue`, { userId: STAFF, method: "signature", signature: "data:image/png;base64,AAAA" });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0].path).toBe("signature");
      expect(storage.objects.size).toBe(before);
    });

    it("records a signed handover as already acknowledged, with the signature image", async () => {
      const res = await post(IT_HEAD, `/api/assets/${id}/issue`, { userId: STAFF, method: "signature", signature: TINY_PNG, note: "Showroom" });
      expect(res.status).toBe(200);
      expect(res.body.acceptance).toMatchObject({ method: "signature", snapshot: ["Custody Scanner", "Charger"], note: "Showroom" });
      expect(res.body.acceptance.signature).toMatch(/^memory:\/\/signed\//);
      expect(res.body.activity[0]).toMatchObject({ action: "Issued asset — signed at handover", detail: "Pooja Deshpande (RPW-EMP-0388) · 2 item(s)" });
    });
  });

  describe("rules", () => {
    let id: string;
    beforeAll(async () => { id = await addAsset("Custody Shredder"); });

    it("refuses issuing for those without the power, and to people of another dealership", async () => {
      expect((await post(BH_MCH, `/api/assets/${id}/issue`, { userId: "U_ANI", method: "in_app" })).status).toBe(403);
      const other = await post(IT_HEAD, `/api/assets/${id}/issue`, { userId: "S_001", method: "signature", signature: TINY_PNG });
      expect(other.status).toBe(400);
      expect(other.body.error.details[0].path).toBe("userId");
    });

    it("hides assets outside the user's scope", async () => {
      expect((await post(BH_HMSI, `/api/assets/${id}/accept`)).status).toBe(404);
      expect((await post(IT_HEAD, "/api/assets/00000000-0000-4000-8000-000000000000/issue", { userId: "U_ANI", method: "in_app" })).status).toBe(404);
    });

    it("lets only one of two simultaneous issues through, and removes the loser's upload", async () => {
      const before = storage.objects.size;
      const [a, b] = await Promise.all([
        post(IT_HEAD, `/api/assets/${id}/issue`, { userId: STAFF, method: "signature", signature: TINY_PNG }),
        post(IT_HEAD, `/api/assets/${id}/issue`, { userId: "U_NIT", method: "signature", signature: TINY_PNG }),
      ]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      expect(storage.objects.size).toBe(before + 1);
    });

    it("accepts assets issued before custody was recorded (seed data), using today's items", async () => {
      const laptop = SEED_ASSETS.find((a) => a.code === "RPW-IT-0142")!; // held by U_ANI, no events
      const res = await post(HR_MANAGER, `/api/assets/${laptop.id}/accept`);
      expect(res.status).toBe(200);
      expect(res.body.acceptance).toMatchObject({ method: "in_app", snapshot: ["Reception Laptop"] });
    });

    it("answers 503 for signatures when Storage is not configured, and changes nothing", async () => {
      const offline = createTestApp(sequelize, {}, createUnconfiguredStorage());
      const target = await addAsset("Custody Fan");
      const res = await request(offline).post(`/api/assets/${target}/issue`).set("Cookie", as[IT_HEAD])
        .send({ userId: STAFF, method: "signature", signature: TINY_PNG });
      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe("storage_unavailable");
      expect((await get(IT_HEAD, `/api/assets/${target}`)).body.assignedTo).toBeNull();
    });
  });

  describe("custody register", () => {
    type Register = { totals: Record<string, number>; people: { userId: string; assets: number; holdings: { code: string }[] }[] };

    it("groups holdings by person, with totals, for the Business Head's dealership", async () => {
      const res = await get(BH_MCH, "/api/custody");
      expect(res.status).toBe(200);
      const body = res.body as Register;
      expect(body.people.map((p) => p.userId)).toEqual(expect.arrayContaining(["U_ANI", STAFF]));
      expect(body.people.flatMap((p) => p.holdings).every((a) => (a as unknown as { dealershipId: string }).dealershipId === "D_MAH_CHK")).toBe(true);
      expect(body.totals.assets).toBe(body.people.reduce((n, p) => n + p.assets, 0));
      expect(body.totals.people).toBe(body.people.length);
    });

    it("filters to one employee (exit checklist)", async () => {
      const body = (await get(IT_HEAD, `/api/custody?userId=${STAFF}`)).body as Register;
      expect(body.people.map((p) => p.userId)).toEqual([STAFF]);
      expect(body.totals.pendingAcceptance).toBe(0);
    });

    it("shows other Business Heads only their dealerships, and refuses managers", async () => {
      const body = (await get(BH_HMSI, "/api/custody")).body as Register;
      expect(body.people.some((p) => p.userId === STAFF)).toBe(false);
      expect((await get(ACCOUNTS, "/api/custody")).status).toBe(403);
      expect((await get(IT_HEAD, "/api/custody?colour=red")).status).toBe(400);
    });
  });
});
