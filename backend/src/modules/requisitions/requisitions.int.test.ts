import request from "supertest";
import type { Sequelize } from "sequelize";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { createApp } from "../../app.js";
import { createTestApp, signIn } from "../../test/test-app.js";
import { openTestDatabase, testDbEnv } from "../../test/test-db.js";

const env = testDbEnv();

/* Seeded people. These tests raise requisitions at MTB (Admin department) and buy furniture,
   so other files' expectations (JCB Nashik procured assets, MTB office-equipment codes) hold. */
const DIRECTOR = "RPW-EMP-0001";   // U_ARJ
const GM_FINANCE = "RPW-EMP-0007"; // U_SUJAY: payment sign-off, sees every requisition
const ADMIN_HEAD = "RPW-EMP-0018"; // U_PARESH: functional head, Admin
const IT_HEAD = "RPW-EMP-0012";    // U_SUNIL: functional head, IT
const HR_HEAD = "RPW-EMP-0009";    // U_SILKI
const MTB_BH = "RPW-EMP-0044";     // U_VIJ
const MTB_MANAGER = "RPW-EMP-0209"; // U_KIR: Admin manager, MTB
const MTB_ACCOUNTS = "RPW-EMP-0215"; // U_RAM: approves advances at MTB
const MTB_EXEC = "RPW-EMP-0312";   // U_SAR: pays at MTB
const NSK_MANAGER = "RPW-EMP-0187"; // U_NIL: IT manager, JCB Nashik
const NSK_ACCOUNTS = "RPW-EMP-0166"; // U_DEE

const REF = /^REQ-2026-\d{4}$/;

describe.skipIf(!env)("requisitions, approvals, procurement and payments (test database)", () => {
  let sequelize: Sequelize;
  let app: ReturnType<typeof createApp>;
  const as: Record<string, string> = {};
  const get = (who: string, path: string) => request(app).get(path).set("Cookie", as[who]);
  const post = (who: string, path: string, body: object = {}) => request(app).post(path).set("Cookie", as[who]).send(body);
  const decide = (who: string, id: string, stage: string, decision = "approved", note = "") =>
    post(who, `/api/requisitions/${id}/decisions/${stage}`, { decision, note });

  const chairs = (extra: object = {}) => ({
    dealershipId: "D_MTB", facilityId: "F12", deptId: "DEP_ADM", item: "Visitor chairs", qty: 6, estCost: 30000,
    justification: "Lounge seating worn out", expectedDelivery: "2026-12-01", ...extra,
  });
  const raise = async (body: object = chairs()) => {
    const res = await post(MTB_MANAGER, "/api/requisitions", body);
    expect(res.status).toBe(201);
    return res.body as { id: string; ref: string };
  };
  /* Raised, approved by the Business Head and the Admin head (and the Director if needed) */
  const approved = async (body: object = chairs()) => {
    const r = await raise(body);
    expect((await decide(MTB_BH, r.id, "bh")).status).toBe(200);
    const res = await decide(ADMIN_HEAD, r.id, "fn");
    if (res.body.directorPurchaseRequired) expect((await decide(DIRECTOR, r.id, "directorPurchase")).status).toBe(200);
    return r;
  };
  const purchase = (cost: number, extra: object = {}) => ({
    purchaseDate: "2026-10-20", vendor: "Godrej Interio", invoiceNo: "GI/2026/77",
    assets: [{ category: "Furniture & Fixtures", name: "Lounge chair set", cost }], ...extra,
  });

  beforeAll(async () => {
    sequelize = openTestDatabase(env!);
    app = createTestApp(sequelize);
    for (const code of [DIRECTOR, GM_FINANCE, ADMIN_HEAD, IT_HEAD, HR_HEAD, MTB_BH, MTB_MANAGER, MTB_ACCOUNTS, MTB_EXEC, NSK_MANAGER, NSK_ACCOUNTS]) {
      as[code] = await signIn(app, code);
    }
  });
  afterAll(() => sequelize?.close());

  describe("seeded requisitions", () => {
    it("come back in the frontend's shape, with their purchases", async () => {
      const all = (await get(DIRECTOR, "/api/requisitions")).body as { ref: string }[];
      expect(all.length).toBeGreaterThanOrEqual(10);
      const r1 = all.find((r) => r.ref === "REQ-2026-0027");
      expect(r1).toMatchObject({
        dealershipId: "D_JCB_NSK", raisedBy: "U_NIL", estCost: 65000, raisedAt: "2026-08-03T04:50:00.000Z",
        advance: { required: true, amount: 20000 },
        bh: { decision: "approved", by: "U_SAM" }, fn: { decision: "approved", by: "U_SUNIL", note: "Standardise on CBS250." },
        payments: { advance: { amount: 20000, ref: "UTR-4471902" }, balance: { amount: 43900, mode: "NEFT" } },
        procurement: { by: "U_SUNIL", actualCost: 63900, invoice: "INV-8841", assetCodes: ["RPW-IT-0171", "RPW-IT-0172"], verification: { decision: "verified" } },
        directorPurchaseRequired: true,
      });
      const covered = all.find((r) => r.ref === "REQ-2026-0019");
      expect(covered).toMatchObject({ fn: { by: "U_ARJ", onBehalfOf: "U_SUNIL", lateDays: 6 }, procurement: null });
    });
  });

  describe("raising", () => {
    it("gives a new reference after the seeded ones and records it", async () => {
      const res = await post(MTB_MANAGER, "/api/requisitions", chairs({ advance: { required: true, amount: 9000, terms: "30% with order" } }));
      expect(res.status).toBe(201);
      expect(res.body.ref).toMatch(REF);
      expect(Number(res.body.ref.slice(-4))).toBeGreaterThan(36);
      expect(res.body).toMatchObject({
        raisedBy: "U_KIR", qty: 6, estCost: 30000, expectedDelivery: "2026-12-01",
        advance: { required: true, amount: 9000, terms: "30% with order" },
        bh: { decision: null }, fn: { decision: null }, procurement: null, directorPurchaseRequired: false,
      });
      const audit = (await get(DIRECTOR, `/api/audit?ref=${res.body.ref}`)).body;
      expect(audit[0]).toMatchObject({ actorId: "U_KIR", action: "Raised requisition", detail: "MTB · Visitor chairs · est. ₹30,000" });
    });

    it("is for managers at their dealerships and functional heads", async () => {
      expect((await post(MTB_BH, "/api/requisitions", chairs())).status).toBe(403);
      expect((await post(MTB_MANAGER, "/api/requisitions", chairs({ dealershipId: "D_JCB_NSK", facilityId: null }))).status).toBe(403);
      expect((await post(ADMIN_HEAD, "/api/requisitions", chairs())).status).toBe(201);
    });

    it("checks the place and department", async () => {
      const field = async (body: object) => (await post(MTB_MANAGER, "/api/requisitions", body)).body.error.details[0].path;
      expect(await field(chairs({ facilityId: "F01" }))).toBe("facilityId");
      expect(await field(chairs({ deptId: "DEP_SAL" }))).toBe("deptId");
      expect(await field(chairs({ advance: { required: true, amount: 40000 } }))).toBe("advance.amount");
    });
  });

  describe("who sees what", () => {
    let id: string;
    beforeAll(async () => { id = (await raise()).id; });

    it("shows a pending requisition to its raiser, approvers and the Director, not to others", async () => {
      for (const who of [MTB_MANAGER, MTB_BH, ADMIN_HEAD, GM_FINANCE, DIRECTOR]) expect((await get(who, `/api/requisitions/${id}`)).status).toBe(200);
      for (const who of [NSK_MANAGER, IT_HEAD, MTB_ACCOUNTS, NSK_ACCOUNTS]) expect((await get(who, `/api/requisitions/${id}`)).status).toBe(404);
      const nilesh = (await get(NSK_MANAGER, "/api/requisitions")).body as { raisedBy: string }[];
      expect(nilesh.every((r) => r.raisedBy === "U_NIL")).toBe(true);
    });

    it("shows it to the dealership's accounts once approved", async () => {
      await decide(MTB_BH, id, "bh");
      await decide(ADMIN_HEAD, id, "fn");
      expect((await get(MTB_ACCOUNTS, `/api/requisitions/${id}`)).status).toBe(200);
      expect((await get(NSK_ACCOUNTS, `/api/requisitions/${id}`)).status).toBe(404);
    });
  });

  describe("approvals", () => {
    it("takes each signature from its owner, once", async () => {
      const { id, ref } = await raise();
      expect((await decide(MTB_MANAGER, id, "bh")).status).toBe(403);
      expect((await decide(ADMIN_HEAD, id, "bh")).status).toBe(403);
      const early = await decide(DIRECTOR, id, "bh");
      expect(early.status).toBe(403);
      expect(early.body.error.message).toMatch(/until it is 3 days overdue/);

      const bh = await decide(MTB_BH, id, "bh", "approved", "Go ahead");
      expect(bh.status).toBe(200);
      expect(bh.body.bh).toMatchObject({ decision: "approved", by: "U_VIJ", note: "Go ahead" });
      expect((await decide(MTB_BH, id, "bh")).status).toBe(409);
      expect((await decide(IT_HEAD, id, "fn")).status).toBe(404);
      expect((await decide(ADMIN_HEAD, id, "fn", "rejected")).status).toBe(400);
      expect((await decide(ADMIN_HEAD, id, "fn", "held", "later")).status).toBe(400);

      const fn = await decide(ADMIN_HEAD, id, "fn");
      expect(fn.body).toMatchObject({ fn: { decision: "approved", by: "U_PARESH" }, directorPurchaseRequired: false });
      expect((await decide(DIRECTOR, id, "directorPurchase")).status).toBe(409);
      const audit = (await get(DIRECTOR, `/api/audit?ref=${ref}`)).body.map((e: { action: string }) => e.action);
      expect(audit.slice(0, 2)).toEqual(["Approved requisition (functional)", "Approved requisition (business head)"]);
    });

    it("needs the Director above the purchase limit", async () => {
      const { id } = await raise(chairs({ estCost: 80000 }));
      await decide(MTB_BH, id, "bh");
      const both = await decide(ADMIN_HEAD, id, "fn");
      expect(both.body.directorPurchaseRequired).toBe(true);
      expect((await post(MTB_MANAGER, `/api/requisitions/${id}/procure`, purchase(80000))).status).toBe(409);
      expect((await decide(ADMIN_HEAD, id, "directorPurchase")).status).toBe(403);
      expect((await decide(DIRECTOR, id, "directorPurchase")).body.directorPurchase).toMatchObject({ decision: "approved", by: "U_ARJ" });
    });

    it("lets the Director act in place of a silent approver after the SLA, and says so", async () => {
      /* Seeded: REQ-2026-0033 (HR, Mahindra Chikalthana) has waited for the HR head since 2 September */
      const all = (await get(DIRECTOR, "/api/requisitions")).body as { id: string; ref: string }[];
      const id = all.find((r) => r.ref === "REQ-2026-0033")!.id;
      const res = await decide(DIRECTOR, id, "fn", "approved", "Overdue");
      expect(res.status).toBe(200);
      expect(res.body.fn).toMatchObject({ decision: "approved", by: "U_ARJ", onBehalfOf: "U_SILKI" });
      expect(res.body.fn.lateDays).toBeGreaterThanOrEqual(3);
      expect((await get(DIRECTOR, "/api/audit?ref=REQ-2026-0033")).body[0].detail).toMatch(/Director acted in place of Silki Monga after \d+ days — Overdue$/);
    });

    it("ends at a rejection; the raiser can revise it once", async () => {
      const { id, ref } = await raise();
      const rejected = await decide(MTB_BH, id, "bh", "rejected", "Not this quarter");
      expect(rejected.body.bh).toMatchObject({ decision: "rejected", note: "Not this quarter" });
      expect((await decide(ADMIN_HEAD, id, "fn")).status).toBe(409);

      const revision = { item: "Visitor chairs (4)", qty: 4, estCost: 20000, justification: "Fewer chairs", expectedDelivery: null };
      expect((await post(NSK_MANAGER, `/api/requisitions/${id}/resubmit`, revision)).status).toBe(404);
      const res = await post(MTB_MANAGER, `/api/requisitions/${id}/resubmit`, revision);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ revisionOf: ref, item: "Visitor chairs (4)", estCost: 20000, bh: { decision: null } });
      expect((await get(MTB_MANAGER, `/api/requisitions/${id}`)).body.resubmittedAs).toBe(res.body.ref);
      expect((await post(MTB_MANAGER, `/api/requisitions/${id}/resubmit`, revision)).status).toBe(409);
    });
  });

  describe("procurement and verification", () => {
    let id: string;
    let ref: string;
    beforeAll(async () => { ({ id, ref } = await approved()); });

    it("is recorded by the department's people, where the requisition is", async () => {
      expect((await post(MTB_BH, `/api/requisitions/${id}/procure`, purchase(31000))).status).toBe(403);
      expect((await post(IT_HEAD, `/api/requisitions/${id}/procure`, purchase(31000))).status).toBe(404);
      const res = await post(MTB_MANAGER, `/api/requisitions/${id}/procure`, purchase(31000));
      expect(res.status).toBe(201);
      expect(res.body.requisition.procurement).toMatchObject({ by: "U_KIR", actualCost: 31000, vendor: "Godrej Interio", verification: null });
      expect(res.body.assets[0]).toMatchObject({ reqRef: ref, dealershipId: "D_MTB", facilityId: "F12", deptId: "DEP_ADM", verified: false });
      expect(res.body.assets[0].code).toMatch(/^RPW\/MTB\/FUR\/\d{2}-\d{2}\/\d{4}$/);
      expect((await post(MTB_MANAGER, `/api/requisitions/${id}/procure`, purchase(31000))).status).toBe(409);
      /* Money waits for verification */
      expect((await decide(GM_FINANCE, id, "financeApproval")).status).toBe(409);
    });

    it("can be sent back, which removes the provisional assets", async () => {
      const before = (await get(DIRECTOR, `/api/requisitions/${id}`)).body.procurement.assetCodes as string[];
      expect((await post(MTB_MANAGER, `/api/requisitions/${id}/verify`, { decision: "verified" })).status).toBe(403);
      expect((await post(ADMIN_HEAD, `/api/requisitions/${id}/verify`, { decision: "sent_back" })).status).toBe(400);
      const res = await post(ADMIN_HEAD, `/api/requisitions/${id}/verify`, { decision: "sent_back", note: "Invoice says 5 chairs" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ procurement: null, sentBack: { by: "U_PARESH", note: "Invoice says 5 chairs" } });
      expect((await get(DIRECTOR, `/api/assets/lookup?code=${encodeURIComponent(before[0])}`)).status).toBe(404);
      expect((await get(DIRECTOR, `/api/audit?ref=${ref}`)).body[0]).toMatchObject({
        action: "Sent asset entry back", detail: `Invoice says 5 chairs · removed ${before[0]}`,
      });
    });

    it("refuses to send back an entry whose assets are in use, and verifies it", async () => {
      const res = await post(MTB_MANAGER, `/api/requisitions/${id}/procure`, purchase(31000));
      expect(res.status).toBe(201);
      const asset = res.body.assets[0];
      expect((await post(ADMIN_HEAD, `/api/assets/${asset.id}/issue`, { userId: "U_KIR", method: "in_app" })).status).toBe(200);
      const refused = await post(ADMIN_HEAD, `/api/requisitions/${id}/verify`, { decision: "sent_back", note: "Wrong" });
      expect(refused.status).toBe(409);
      expect(refused.body.error.message).toContain(asset.code);

      const ok = await post(ADMIN_HEAD, `/api/requisitions/${id}/verify`, { decision: "verified", note: "Matches invoice" });
      expect(ok.body.procurement.verification).toMatchObject({ decision: "verified", by: "U_PARESH", note: "Matches invoice" });
      expect((await get(DIRECTOR, `/api/assets/${asset.id}`)).body.verified).toBe(true);
      expect((await post(ADMIN_HEAD, `/api/requisitions/${id}/verify`, { decision: "verified" })).status).toBe(409);
    });

    it("then needs GM Finance and the Director before the balance is paid", async () => {
      expect((await decide(DIRECTOR, id, "directorApproval")).status).toBe(409);
      expect((await decide(MTB_ACCOUNTS, id, "financeApproval")).status).toBe(403);
      expect((await decide(GM_FINANCE, id, "financeApproval")).status).toBe(200);
      expect((await post(MTB_EXEC, `/api/requisitions/${id}/payments/balance`, { amount: 31000, mode: "NEFT", ref: "UTR-1" })).status).toBe(409);
      expect((await decide(DIRECTOR, id, "directorApproval", "held", "Check delivery")).body.directorApproval).toMatchObject({ decision: "held" });
      expect((await decide(DIRECTOR, id, "directorApproval")).status).toBe(200);

      expect((await post(MTB_ACCOUNTS, `/api/requisitions/${id}/payments/balance`, { amount: 31000, mode: "NEFT", ref: "UTR-1" })).status).toBe(403);
      const over = await post(MTB_EXEC, `/api/requisitions/${id}/payments/balance`, { amount: 31001, mode: "NEFT", ref: "UTR-1" });
      expect(over.body.error.details[0]).toMatchObject({ path: "amount", message: "At most the ₹31,000 outstanding" });
      const paid = await post(MTB_EXEC, `/api/requisitions/${id}/payments/balance`, { amount: 31000, mode: "RTGS", ref: "UTR-5501" });
      expect(paid.status).toBe(201);
      expect(paid.body.payments.balance).toMatchObject({ by: "U_SAR", amount: 31000, mode: "RTGS", ref: "UTR-5501" });
      expect((await post(MTB_EXEC, `/api/requisitions/${id}/payments/balance`, { amount: 1, mode: "NEFT", ref: "UTR-2" })).status).toBe(409);
      expect((await get(DIRECTOR, `/api/audit?ref=${ref}`)).body[0]).toMatchObject({ action: "Paid balance", detail: "₹31,000 · RTGS · UTR-5501 · MTB" });
    });
  });

  describe("cost overrun", () => {
    it("needs the Director's re-approval before sign-off; a query keeps it waiting", async () => {
      const { id } = await approved(chairs({ estCost: 40000 }));
      const bought = await post(ADMIN_HEAD, `/api/requisitions/${id}/procure`, purchase(45000));
      expect(bought.body.requisition.procurement.verification).toMatchObject({ decision: "verified", by: "U_PARESH" });
      expect((await decide(GM_FINANCE, id, "financeApproval")).status).toBe(409);
      expect((await decide(DIRECTOR, id, "varianceApproval", "rejected", "x")).status).toBe(400);
      expect((await decide(DIRECTOR, id, "varianceApproval", "queried", "Why 12% more?")).body.varianceApproval).toMatchObject({ decision: "queried" });
      expect((await decide(GM_FINANCE, id, "financeApproval")).status).toBe(409);
      expect((await decide(DIRECTOR, id, "varianceApproval")).status).toBe(200);
      expect((await decide(GM_FINANCE, id, "financeApproval")).status).toBe(200);
    });
  });

  describe("vendor advance", () => {
    it("goes to Accounts, then GM Finance and the Director above the limit, then is paid", async () => {
      const { id, ref } = await approved(chairs({ estCost: 150000, advance: { required: true, amount: 60000, terms: "40% advance" } }));
      const pay = (amount: number) => post(MTB_EXEC, `/api/requisitions/${id}/payments/advance`, { amount, mode: "NEFT", ref: "UTR-ADV" });
      expect((await pay(60000)).status).toBe(409);
      expect((await decide(NSK_ACCOUNTS, id, "advanceApproval")).status).toBe(404);
      expect((await decide(MTB_ACCOUNTS, id, "advanceApproval", "held", "Bank details pending")).status).toBe(200);
      expect((await decide(MTB_ACCOUNTS, id, "advanceApproval")).status).toBe(200);
      expect((await decide(DIRECTOR, id, "advanceDirector")).status).toBe(409);
      expect((await decide(GM_FINANCE, id, "advanceFinance")).status).toBe(200);
      expect((await decide(DIRECTOR, id, "advanceDirector")).status).toBe(200);
      expect((await pay(60001)).body.error.details[0]).toMatchObject({ path: "amount", message: "At most the approved advance of ₹60,000" });
      const paid = await pay(60000);
      expect(paid.status).toBe(201);
      expect(paid.body.payments.advance).toMatchObject({ amount: 60000, by: "U_SAR" });
      const actions = (await get(DIRECTOR, `/api/audit?ref=${ref}`)).body.map((e: { action: string }) => e.action);
      expect(actions.slice(0, 5)).toEqual([
        "Paid vendor advance", "Approved advance (Director)", "Approved advance (GM Finance)", "Approved advance for payment", "Held advance",
      ]);
    });
  });
});
