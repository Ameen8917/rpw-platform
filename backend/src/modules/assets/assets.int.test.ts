import request from "supertest";
import type { Sequelize } from "sequelize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { createApp } from "../../app.js";
import { SEED_ASSETS } from "../../db/seed/asset-data.js";
import { createTestApp, signIn } from "../../test/test-app.js";
import { openTestDatabase, testDbEnv } from "../../test/test-db.js";
import { fyOf, todayIST } from "./asset-rules.js";

const env = testDbEnv();

/* Seeded people (prototype data) */
const DIRECTOR = "RPW-EMP-0001";   // U_ARJ, sees everything
const IT_HEAD = "RPW-EMP-0012";    // U_SUNIL, corporate functional head
const BH_HMSI_CL = "RPW-EMP-0034"; // U_VIS, Business Head of D_HMSI and D_CL
const IT_MANAGER = "RPW-EMP-0187"; // U_NIL, manager at D_JCB_NSK

const seeded = (code: string) => SEED_ASSETS.find((a) => a.code === code)!;
const TABLET = seeded("RPW-IT-0171");   // procured (REQ-2026-0027), JCB Nashik, 2 accessories, tag 100011
const SOFA = seeded("RPW-FUR-0233");    // HMSI
const PURIFIER = seeded("RPW-OFF-0044"); // MTB

const newAsset = (o: Record<string, unknown> = {}) => ({
  category: "IT Equipment", name: "Workshop Laptop", make: "Lenovo", model: "ThinkPad E14", serial: "LN-001",
  purchaseDate: "2026-09-06", cost: 58000, vendor: "Lenovo India", dealershipId: "D_JCB_NSK", ...o,
});

describe.skipIf(!env)("assets API (test database)", () => {
  let sequelize: Sequelize;
  let app: ReturnType<typeof createApp>;
  const as: Record<string, string> = {};
  const get = (who: string, path: string) => request(app).get(path).set("Cookie", as[who]);
  const post = (who: string, path: string, body: object) => request(app).post(path).set("Cookie", as[who]).send(body);

  beforeAll(async () => {
    sequelize = openTestDatabase(env!);
    app = createTestApp(sequelize);
    for (const code of [DIRECTOR, IT_HEAD, BH_HMSI_CL, IT_MANAGER]) as[code] = await signIn(app, code);
  });
  afterAll(() => sequelize?.close());

  /* Read tests run first, against the seeded assets. Other test files add assets of their own
     (custody tests use Mahindra Chikalthana), so counts here avoid that dealership. */
  describe("register", () => {
    const codes = (res: request.Response) => (res.body as { code: string }[]).map((a) => a.code).sort();

    it("shows the Director every asset", async () => {
      const res = await get(DIRECTOR, "/api/assets");
      expect(res.status).toBe(200);
      expect(codes(res)).toEqual(expect.arrayContaining(SEED_ASSETS.map((a) => a.code)));
    });

    it("scopes a Business Head to their dealerships and a manager to theirs", async () => {
      expect(codes(await get(BH_HMSI_CL, "/api/assets"))).toEqual(["RPW-DIAG-0035", "RPW-FUR-0233"]);
      const mine = await get(IT_MANAGER, "/api/assets");
      expect(mine.body.every((a: { dealershipId: string }) => a.dealershipId === "D_JCB_NSK")).toBe(true);
      expect(mine.body).toHaveLength(4);
      /* a filter cannot widen the scope */
      expect((await get(BH_HMSI_CL, "/api/assets?dealershipId=D_MTB")).body).toEqual([]);
    });

    it("filters by dealership, source and status", async () => {
      expect((await get(DIRECTOR, "/api/assets?dealershipId=D_JCB_NSK")).body).toHaveLength(4);
      /* seeded ones only: other test files procure assets too (codes in the new RPW/... format) */
      expect(codes(await get(DIRECTOR, "/api/assets?source=procured")).filter((c) => c.startsWith("RPW-")))
        .toEqual(["RPW-IT-0171", "RPW-IT-0172", "RPW-IT-0175", "RPW-OFF-0044"]);
      expect(codes(await get(DIRECTOR, "/api/assets?status=under_repair"))).toEqual(["RPW-WRK-0091"]);
      expect(codes(await get(DIRECTOR, "/api/assets?dealershipId=D_JCB_NSK&source=procured"))).toEqual(["RPW-IT-0171", "RPW-IT-0172"]);
    });

    it("searches name, code and make case-insensitively, with no wildcards", async () => {
      expect(codes(await get(DIRECTOR, "/api/assets?q=dell"))).toEqual(["RPW-IT-0142"]);
      expect(codes(await get(DIRECTOR, "/api/assets?q=sofa"))).toEqual(["RPW-FUR-0233"]);
      expect((await get(DIRECTOR, "/api/assets?q=rpw-it-01")).body).toHaveLength(6);
      expect((await get(DIRECTOR, "/api/assets?q=%25")).body).toEqual([]);
      expect((await get(DIRECTOR, "/api/assets?q=RPW_IT")).body).toEqual([]);
    });

    it("returns assets shaped like the frontend's Asset, with book value", async () => {
      const tablet = (await get(IT_MANAGER, "/api/assets")).body.find((a: { code: string }) => a.code === TABLET.code);
      expect(tablet).toMatchObject({
        id: TABLET.id, tagId: "100011", category: "IT Equipment", cost: 22400, purchaseDate: "2026-08-12",
        source: "procured", reqRef: "REQ-2026-0027", assignedTo: "U_NIL", acceptance: null, returnRecord: null,
        accessories: [
          { name: "25W charger & cable", origin: "bundled", cost: 0, addedAt: "2026-08-12", status: "with_asset" },
          { name: "Protective case", origin: "separate", cost: 850 },
        ],
      });
      expect(tablet.depreciation).toMatchObject({ life: 3, fullyDepreciated: false });
      expect(tablet.depreciation.nbv).toBeLessThan(22400);
    });

    it("rejects unknown filter values", async () => {
      const res = await get(DIRECTOR, "/api/assets?source=stolen");
      expect(res.status).toBe(400);
      expect(res.body.error.details[0]).toMatchObject({ location: "query", path: "source" });
    });
  });

  describe("detail and lookup", () => {
    it("includes the activity for the asset and its requisition, newest first", async () => {
      const res = await get(IT_MANAGER, `/api/assets/${TABLET.id}`);
      expect(res.status).toBe(200);
      expect(res.body.activity.map((e: { action: string }) => e.action)).toEqual([
        "Procured requisition", "Approved requisition (functional)", "Approved requisition (business head)",
      ]);
      expect(res.body.activity[0]).toMatchObject({ actorId: "U_SUNIL", ref: "REQ-2026-0027", at: "2026-08-12T05:30:00.000Z" });
    });

    it("answers 404, not 403, for assets outside the user's scope", async () => {
      expect((await get(IT_MANAGER, `/api/assets/${PURIFIER.id}`)).status).toBe(404);
      expect((await get(DIRECTOR, "/api/assets/00000000-0000-4000-8000-000000000000")).status).toBe(404);
      expect((await get(DIRECTOR, "/api/assets/RPW-IT-0171")).status).toBe(400);
    });

    it("finds an asset by full code in any case, or by tag ID", async () => {
      const byCode = await get(BH_HMSI_CL, "/api/assets/lookup?code=rpw-fur-0233");
      expect(byCode.status).toBe(200);
      expect(byCode.body.id).toBe(SOFA.id);
      const byTag = await get(IT_MANAGER, "/api/assets/lookup?code=100011");
      expect(byTag.body).toMatchObject({ code: TABLET.code, accessories: [{}, {}] });
    });

    it("does not find assets outside scope, or that do not exist", async () => {
      expect((await get(BH_HMSI_CL, `/api/assets/lookup?code=${encodeURIComponent(TABLET.code)}`)).status).toBe(404);
      expect((await get(DIRECTOR, "/api/assets/lookup?code=999999")).status).toBe(404);
      expect((await get(DIRECTOR, "/api/assets/lookup?code=RPW-IT-01%25")).status).toBe(404);
      expect((await get(DIRECTOR, "/api/assets/lookup")).status).toBe(400);
    });
  });

  describe("add existing asset", () => {
    it("is refused for Business Heads and managers", async () => {
      for (const who of [BH_HMSI_CL, IT_MANAGER]) {
        const res = await post(who, "/api/assets", newAsset());
        expect(res.status).toBe(403);
        expect(res.body.error.code).toBe("forbidden");
      }
    });

    it("generates the code and tag, saves bundled items and the holder, and logs it", async () => {
      const res = await post(DIRECTOR, "/api/assets", newAsset({
        bundled: ["Charger", "Laptop bag"], assignedTo: "S_001", deptId: "DEP_SER",
        invoiceDoc: { vendor: "Lenovo India", invoiceNo: "LN/2026/118", invoiceDate: "2026-09-06", total: 58000 },
      }));
      expect(res.status).toBe(201);
      expect(res.headers.location).toBe(`/api/assets/${res.body.id}`);
      expect(res.body).toMatchObject({
        code: "RPW/JNS/IT/26-27/0001", source: "existing", status: "in_use",
        dealershipId: "D_JCB_NSK", deptId: "DEP_SER",
        /* no location given: placed where the holder works */
        facilityId: "F01", assignedTo: "S_001", issuedBy: "U_ARJ",
        accessories: [{ name: "Charger", origin: "bundled", addedAt: "2026-09-06" }, { name: "Laptop bag" }],
        invoiceDoc: { invoiceNo: "LN/2026/118" },
      });
      expect(Number(res.body.tagId)).toBeGreaterThan(100014); // after the seeded tags
      expect(res.body.verified).toBeUndefined();
      /* custody starts at registration, unacknowledged */
      expect(res.body.acceptance).toBeNull();
      expect(res.body.custodyHistory).toEqual([expect.objectContaining({
        kind: "issue", holderId: "S_001", actorId: "U_ARJ", method: null, snapshot: ["Workshop Laptop", "Charger", "Laptop bag"],
      })]);
      expect(res.body.activity).toEqual([expect.objectContaining({
        actorId: "U_ARJ", action: "Added existing asset", ref: "RPW/JNS/IT/26-27/0001",
        detail: "Opening stock · ₹58,000 · JCB Nashik",
      })]);

      /* saved: visible to the dealership, survives a fresh read */
      const again = await get(IT_MANAGER, `/api/assets/${res.body.id}`);
      expect(again.body).toMatchObject({ code: "RPW/JNS/IT/26-27/0001", accessories: [{}, {}] });
    });

    it("numbers per dealership, category and financial year", async () => {
      expect((await post(IT_HEAD, "/api/assets", newAsset())).body.code).toBe("RPW/JNS/IT/26-27/0002");
      expect((await post(IT_HEAD, "/api/assets", newAsset({ purchaseDate: "2026-03-31" }))).body.code).toBe("RPW/JNS/IT/25-26/0001");
      expect((await post(IT_HEAD, "/api/assets", newAsset({ category: "Workshop Equipment" }))).body.code).toBe("RPW/JNS/WRK/26-27/0001");
      /* no purchase date: today's financial year */
      const undated = await post(IT_HEAD, "/api/assets", newAsset({ dealershipId: "D_CORP", purchaseDate: "" }));
      expect(undated.body).toMatchObject({ code: `RPW/COR/IT/${fyOf(todayIST(new Date()))}/0001`, purchaseDate: null, depreciation: null });
    });

    it("never gives two simultaneous adds the same code", async () => {
      const results = await Promise.all(Array.from({ length: 6 }, (_, i) =>
        post(IT_HEAD, "/api/assets", newAsset({ dealershipId: "D_MTB", category: "Office Equipment", name: `Printer ${i}` }))));
      expect(results.map((r) => r.status)).toEqual(Array(6).fill(201));
      expect(results.map((r) => r.body.code).sort()).toEqual([1, 2, 3, 4, 5, 6].map((n) => `RPW/MTB/OFF/26-27/000${n}`));
      expect(new Set(results.map((r) => r.body.tagId)).size).toBe(6);
    });

    it("checks references against the organisation", async () => {
      const field = async (body: Record<string, unknown>) => {
        const res = await post(DIRECTOR, "/api/assets", newAsset(body));
        expect(res.status).toBe(400);
        return res.body.error.details[0].path;
      };
      expect(await field({ dealershipId: "D_NOPE" })).toBe("dealershipId");
      expect(await field({ dealershipId: "D_MAH_BBP" })).toBe("dealershipId"); // inactive
      expect(await field({ facilityId: "F12" })).toBe("facilityId");           // MTB's location
      expect(await field({ deptId: "DEP_NOPE" })).toBe("deptId");
      expect(await field({ assignedTo: "S_004" })).toBe("assignedTo");         // works at MTB
    });

    it("validates the body", async () => {
      const res = await post(DIRECTOR, "/api/assets", { ...newAsset(), cost: undefined, code: "RPW/JNS/IT/26-27/0099" });
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual(["", "cost"]);
    });
  });

  describe("audit trail", () => {
    it("is readable by the Director and functional heads only", async () => {
      expect((await get(IT_MANAGER, "/api/audit")).status).toBe(403);
      const res = await get(IT_HEAD, `/api/audit?ref=${encodeURIComponent("RPW/JNS/IT/26-27/0002")}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ total: 1, page: 1, pageSize: 10 });
      expect(res.body.entries).toEqual([expect.objectContaining({ actorId: "U_SUNIL", action: "Added existing asset" })]);
    });

    it("pages through the whole trail, newest first, without repeats", async () => {
      const first = (await get(DIRECTOR, "/api/audit?pageSize=3")).body;
      const second = (await get(DIRECTOR, "/api/audit?pageSize=3&page=2")).body;
      expect(first.entries).toHaveLength(3);
      expect(second).toMatchObject({ page: 2, pageSize: 3, total: first.total });
      expect(first.total).toBeGreaterThan(6);
      const ids = [...first.entries, ...second.entries].map((e: { id: string }) => e.id);
      expect(new Set(ids).size).toBe(6);
      const times = [...first.entries, ...second.entries].map((e: { at: string }) => e.at);
      expect([...times].sort().reverse()).toEqual(times);

      const past = (await get(DIRECTOR, `/api/audit?pageSize=3&page=${Math.ceil(first.total / 3) + 1}`)).body;
      expect(past).toMatchObject({ entries: [], total: first.total });
    });

    it("searches the whole trail by action, reference, detail and the person's name", async () => {
      const byName = (await get(DIRECTOR, "/api/audit?q=sunil&pageSize=100")).body;
      expect(byName.total).toBeGreaterThan(0);
      expect(byName.entries.every((e: { actorId: string; action: string; ref: string; detail: string }) =>
        e.actorId === "U_SUNIL" || /sunil/i.test(e.action + e.ref + e.detail))).toBe(true);

      const byAction = (await get(DIRECTOR, "/api/audit?q=added%20existing")).body;
      expect(byAction.total).toBeGreaterThan(0);
      expect(byAction.entries.every((e: { action: string }) => /added existing/i.test(e.action))).toBe(true);

      /* % and _ are matched literally, not as wildcards */
      expect((await get(DIRECTOR, "/api/audit?q=%25%25%25")).body).toMatchObject({ entries: [], total: 0 });
    });

    it("rejects bad paging values and the old limit parameter", async () => {
      for (const q of ["page=0", "page=x", "pageSize=101", "pageSize=0", "limit=3"]) {
        expect((await get(DIRECTOR, `/api/audit?${q}`)).status).toBe(400);
      }
    });

    it("cannot be changed or deleted, even directly in the database", async () => {
      const schema = env!.DATABASE_SCHEMA;
      await expect(sequelize.query(`UPDATE "${schema}".audit_log SET detail = 'edited'`)).rejects.toThrow(/append-only/);
      await expect(sequelize.query(`DELETE FROM "${schema}".audit_log`)).rejects.toThrow(/append-only/);
    });
  });
});
