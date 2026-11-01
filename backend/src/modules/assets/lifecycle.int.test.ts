import request from "supertest";
import type { Sequelize } from "sequelize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { createApp } from "../../app.js";
import { TINY_PNG } from "../../test/fixtures.js";
import { createTestApp, signIn } from "../../test/test-app.js";
import { openTestDatabase, testDbEnv } from "../../test/test-db.js";

const env = testDbEnv();

/* Seeded people. These tests work in MTB (D_MTB) with IT and furniture categories, so other test
   files' expectations (including MTB office-equipment codes) are not disturbed. */
const IT_HEAD = "RPW-EMP-0012";    // U_SUNIL: functional head, adds accessories, procures (verified)
const GM_FINANCE = "RPW-EMP-0007"; // U_SUJAY: may dispose (grant)
const DIRECTOR = "RPW-EMP-0001";   // U_ARJ
const MTB_MANAGER = "RPW-EMP-0209"; // U_KIR: procures for MTB only (awaits verification)
const MTB_BH = "RPW-EMP-0044";     // U_VIJ: Business Head, cannot procure
const NSK_MANAGER = "RPW-EMP-0187"; // U_NIL: manager at JCB Nashik
const STAFF = "S_004";             // Imran Shaikh: no login, MTB

const CODE = /^RPW\/MTB\/(IT|FUR)\/26-27\/\d{4}$/;

describe.skipIf(!env)("accessories, disposal and procured assets (test database)", () => {
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

  const purchase = (reqRef: string, extra: object = {}) => ({
    reqRef, dealershipId: "D_MTB", facilityId: "F12", deptId: "DEP_ADM", purchaseDate: "2026-10-01",
    vendor: "Croma", invoiceNo: "CR/2026/881",
    assets: [
      { category: "IT Equipment", name: "Front Desk Laptop", make: "HP", cost: 62000, bundled: ["Charger"] },
      { category: "IT Equipment", name: "Parts Counter PC", cost: 48000.5, assignedTo: STAFF },
    ],
    ...extra,
  });

  beforeAll(async () => {
    sequelize = openTestDatabase(env!);
    app = createTestApp(sequelize);
    for (const code of [IT_HEAD, GM_FINANCE, DIRECTOR, MTB_MANAGER, MTB_BH, NSK_MANAGER]) as[code] = await signIn(app, code);
  });
  afterAll(() => sequelize?.close());

  describe("POST /api/assets/procured", () => {
    it("creates one asset per line from a manager's entry, awaiting verification", async () => {
      const res = await post(MTB_MANAGER, "/api/assets/procured", purchase("REQ-2026-0901"));
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        reqRef: "REQ-2026-0901", by: "U_KIR", actualCost: 110000.5, vendor: "Croma", invoice: "CR/2026/881", verified: false,
      });
      const [laptop, pc] = res.body.assets;
      expect(res.body.assetCodes).toEqual([laptop.code, pc.code]);
      expect(laptop.code).toMatch(CODE);
      expect(laptop).toMatchObject({
        source: "procured", reqRef: "REQ-2026-0901", dealershipId: "D_MTB", facilityId: "F12", deptId: "DEP_ADM",
        purchaseDate: "2026-10-01", vendor: "Croma", verified: false, assignedTo: null,
        accessories: [{ name: "Charger", origin: "bundled", cost: 0 }],
      });
      expect(pc).toMatchObject({ cost: 48000.5, assignedTo: STAFF, issuedBy: "U_KIR", acceptance: null });

      const detail = await get(DIRECTOR, `/api/assets/${pc.id}`);
      expect(detail.body.custodyHistory).toMatchObject([{ kind: "issue", holderId: STAFF, method: null, snapshot: ["Parts Counter PC"] }]);
      expect(detail.body.activity[0]).toMatchObject({
        actorId: "U_KIR", action: "Entered procured assets — awaiting verification", ref: "REQ-2026-0901",
        detail: "2 asset(s) · ₹1,10,000.5 · Croma",
      });
    });

    it("is verified at once when a functional head enters it", async () => {
      const res = await post(IT_HEAD, "/api/assets/procured", purchase("REQ-2026-0902", { assets: [{ category: "IT Equipment", name: "Router", cost: 9000 }] }));
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ verified: true, assets: [{ verified: true }] });
      expect((await get(DIRECTOR, "/api/audit?ref=REQ-2026-0902")).body.entries[0]).toMatchObject({ action: "Procured requisition" });
    });

    it("records each requisition once, including seeded ones and simultaneous attempts", async () => {
      expect((await post(MTB_MANAGER, "/api/assets/procured", purchase("REQ-2026-0901"))).status).toBe(409);
      expect((await post(IT_HEAD, "/api/assets/procured", purchase("REQ-2026-0027"))).status).toBe(409);

      const results = await Promise.all([1, 2, 3].map(() => post(MTB_MANAGER, "/api/assets/procured", purchase("REQ-2026-0903"))));
      expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
      const procured = (await get(DIRECTOR, "/api/assets?source=procured&dealershipId=D_MTB")).body as { reqRef: string }[];
      expect(procured.filter((a) => a.reqRef === "REQ-2026-0903")).toHaveLength(2);
    });

    it("is for those who procure, within their own dealerships", async () => {
      expect((await post(MTB_BH, "/api/assets/procured", purchase("REQ-2026-0904"))).status).toBe(403);
      expect((await post(NSK_MANAGER, "/api/assets/procured", purchase("REQ-2026-0904"))).status).toBe(403);
    });

    it("checks references and holders before creating anything", async () => {
      const field = async (body: object) => (await post(IT_HEAD, "/api/assets/procured", body)).body.error.details[0].path;
      expect(await field(purchase("REQ-2026-0905", { facilityId: "F01" }))).toBe("facilityId");
      const line = { category: "IT Equipment", name: "Laptop", cost: 50000 };
      expect(await field(purchase("REQ-2026-0905", { assets: [line, { ...line, assignedTo: "U_NIL" }] }))).toBe("assets.1.assignedTo");
      /* nothing was recorded, so the reference is still free */
      expect((await post(IT_HEAD, "/api/assets/procured", purchase("REQ-2026-0905", { assets: [line] }))).status).toBe(201);
    });
  });

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
