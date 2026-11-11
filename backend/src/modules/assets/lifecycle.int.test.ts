import request from "supertest";
import type { Sequelize } from "sequelize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { createApp } from "../../app.js";
import { TINY_PNG } from "../../test/fixtures.js";
import { createTestApp, signIn } from "../../test/test-app.js";
import { openTestDatabase, testDbEnv } from "../../test/test-db.js";

const env = testDbEnv();

/* Seeded people. These tests work in MTB (D_MTB) with furniture, so other test files'
   expectations (including MTB office-equipment codes) are not disturbed. Procured assets are
   covered with their requisitions (requisitions.int.test.ts). */
const IT_HEAD = "RPW-EMP-0012";    // U_SUNIL: functional head, adds accessories
const GM_FINANCE = "RPW-EMP-0007"; // U_SUJAY: may dispose (grant)
const DIRECTOR = "RPW-EMP-0001";   // U_ARJ
const MTB_MANAGER = "RPW-EMP-0209"; // U_KIR: manager, cannot add accessories
const STAFF = "S_004";             // Imran Shaikh: no login, MTB


describe.skipIf(!env)("accessories and disposal (test database)", () => {
  let sequelize: Sequelize;
  let app: ReturnType<typeof createApp>;
  const as: Record<string, string> = {};
  const get = (who: string, path: string) => request(app).get(path).set("Cookie", as[who]);
  const post = (who: string, path: string, body: object = {}) => request(app).post(path).set("Cookie", as[who]).send(body);

  const addAsset = async (name: string, extra: object = {}) => {
    const res = await post(IT_HEAD, "/api/assets", {
      category: "Furniture & Fixtures", name, cost: 30000, purchaseDate: "2026-06-01", dealershipId: "D_MTB", facilityId: "F12", ...extra,
    });
    expect(res.status).toBe(201);
    return res.body.id as string;
  };

  beforeAll(async () => {
    sequelize = openTestDatabase(env!);
    app = createTestApp(sequelize);
    for (const code of [IT_HEAD, GM_FINANCE, DIRECTOR, MTB_MANAGER]) as[code] = await signIn(app, code);
  });
  afterAll(() => sequelize?.close());

  describe("POST /api/assets/:id/accessories", () => {
    let id: string;
    beforeAll(async () => { id = await addAsset("Reception Desk", { bundled: ["Drawer key"] }); });

    it("adds bundled and separately bought items in order", async () => {
      const bought = await post(IT_HEAD, `/api/assets/${id}/accessories`, { name: "Desk lamp", origin: "separate", cost: 850, addedAt: "2026-10-02", serial: "DL-7" });
      expect(bought.status).toBe(201);
      const bundled = await post(IT_HEAD, `/api/assets/${id}/accessories`, { name: "Cable tray", origin: "bundled" });
      expect(bundled.body.accessories).toEqual([
        expect.objectContaining({ name: "Drawer key" }),
        { name: "Desk lamp", serial: "DL-7", origin: "separate", cost: 850, addedAt: "2026-10-02", status: "with_asset" },
        expect.objectContaining({ name: "Cable tray", origin: "bundled", cost: 0, serial: "—" }),
      ]);
      expect(bought.body.activity[0]).toMatchObject({ actorId: "U_SUNIL", action: "Added accessory", detail: "Desk lamp · ₹850 expensed" });
      expect(bundled.body.activity[0]).toMatchObject({ detail: "Cable tray · bundled with asset" });
    });

    it("rejects separate purchases at or above the capitalisation floor", async () => {
      const res = await post(IT_HEAD, `/api/assets/${id}/accessories`, { name: "Monitor", origin: "separate", cost: 5000 });
      expect(res.status).toBe(400);
      expect(res.body.error.details[0].path).toBe("cost");
    });

    it("is for those who add assets, on assets they can see", async () => {
      expect((await post(MTB_MANAGER, `/api/assets/${id}/accessories`, { name: "Key", origin: "bundled" })).status).toBe(403);
      expect((await post(IT_HEAD, "/api/assets/00000000-0000-4000-8000-000000000000/accessories", { name: "Key", origin: "bundled" })).status).toBe(404);
    });
  });

  describe("POST /api/assets/:id/dispose", () => {
    let id: string;
    beforeAll(async () => { id = await addAsset("Old Waiting Sofa", { assignedTo: STAFF, purchaseDate: "2018-04-01" }); });

    it("is for the Director and those granted it", async () => {
      expect((await post(IT_HEAD, `/api/assets/${id}/dispose`, { reason: "Worn out" })).status).toBe(403);
    });

    it("refuses an issued asset until its return is recorded", async () => {
      const res = await post(GM_FINANCE, `/api/assets/${id}/dispose`, { reason: "Worn out" });
      expect(res.status).toBe(409);
      expect(res.body.error.message).toMatch(/record its return first/);
      expect((await post(IT_HEAD, `/api/assets/${id}/return`, { condition: "Not working", signature: TINY_PNG })).status).toBe(200);
    });

    it("writes the asset off with its book value on the day", async () => {
      const res = await post(GM_FINANCE, `/api/assets/${id}/dispose`, { reason: "Beyond repair", scrapValue: 1500 });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status: "disposed", assignedTo: null,
        disposal: { reason: "Beyond repair", scrapValue: 1500, by: "U_SUJAY" },
      });
      expect(res.body.disposal.bookValue).toBeCloseTo(res.body.depreciation.nbv, 2);
      expect(res.body.activity[0]).toMatchObject({ actorId: "U_SUJAY", action: "Disposed asset", detail: "Beyond repair · scrap ₹1,500" });
      expect((await get(DIRECTOR, "/api/assets?status=disposed&dealershipId=D_MTB")).body.map((a: { id: string }) => a.id)).toContain(id);
    });

    it("allows no further changes", async () => {
      expect((await post(DIRECTOR, `/api/assets/${id}/dispose`, { reason: "Again" })).status).toBe(409);
      expect((await post(IT_HEAD, `/api/assets/${id}/accessories`, { name: "Cushion", origin: "bundled" })).status).toBe(409);
      expect((await post(IT_HEAD, `/api/assets/${id}/issue`, { userId: STAFF, method: "signature", signature: TINY_PNG })).status).toBe(409);
    });
  });
});
