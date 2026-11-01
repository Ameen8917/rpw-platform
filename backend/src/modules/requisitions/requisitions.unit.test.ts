import { describe, expect, it } from "vitest";
import { LIMIT_DEFAULTS } from "../settings/settings.schemas.js";
import { balanceDue, escalation, needsDirectorPurchase, payStatus, reqStatus, variance } from "./requisition-rules.js";
import type { ApprovalSlotDto, RequisitionDto } from "./requisitions.dto.js";
import { decisionBody, paymentBody, procureBody, raiseBody, verifyBody } from "./requisitions.schemas.js";

const L = LIMIT_DEFAULTS;
const ok = (at = "2026-09-02T09:00:00.000Z"): ApprovalSlotDto => ({ decision: "approved", by: "U_X", at, note: "" });
const open = (): ApprovalSlotDto => ({ decision: null, by: null, at: null, note: "" });

function req(over: Partial<RequisitionDto> = {}): RequisitionDto {
  return {
    id: "r", ref: "REQ-2026-0100", dealershipId: "D_MTB", facilityId: null, deptId: "DEP_ADM", item: "Chairs", qty: 4,
    estCost: 40000, justification: "Worn out", raisedBy: "U_KIR", raisedAt: "2026-09-01T09:00:00.000Z",
    advance: { required: false, amount: 0, terms: "" }, bh: open(), fn: open(),
    payments: { advance: null, balance: null }, procurement: null, directorPurchaseRequired: false, ...over,
  };
}

const purchase = (actualCost: number, verified = true) => ({
  by: "U_KIR", at: "2026-09-10T09:00:00.000Z", actualCost, vendor: "V", invoice: "I", assetCodes: ["A"], invoiceDoc: null,
  verification: verified ? { decision: "verified" as const, by: "U_PARESH", at: "2026-09-11T09:00:00.000Z", note: "" } : null,
});

describe("requisition status", () => {
  it("needs both signatures, and the Director when required", () => {
    expect(reqStatus(req({ bh: ok() }))).toBe("pending");
    expect(reqStatus(req({ bh: ok(), fn: ok() }))).toBe("approved");
    expect(reqStatus(req({ bh: ok(), fn: ok(), directorPurchaseRequired: true }))).toBe("pending");
    expect(reqStatus(req({ bh: ok(), fn: ok(), directorPurchaseRequired: true, directorPurchase: ok() }))).toBe("approved");
  });

  it("ends at any rejection, and is procured once bought", () => {
    expect(reqStatus(req({ bh: ok(), fn: { ...ok(), decision: "rejected" } }))).toBe("rejected");
    expect(reqStatus(req({ bh: ok(), fn: ok(), directorPurchaseRequired: true, directorPurchase: { ...ok(), decision: "rejected" } }))).toBe("rejected");
    expect(reqStatus(req({ bh: ok(), fn: ok(), procurement: purchase(40000) }))).toBe("procured");
  });

  it("brings the Director in above the group limit or an approver's personal limit, never for Corporate", () => {
    const at = (estCost: number, approverLimits: (number | null)[] = [], isCorporate = false) =>
      needsDirectorPurchase({ estCost }, { isCorporate, limits: L, approverLimits });
    expect(at(50000)).toBe(false);
    expect(at(50001)).toBe(true);
    expect(at(30000, [null, 25000])).toBe(true);
    expect(at(20000, [25000])).toBe(false);
    expect(at(500000, [1000], true)).toBe(false);
  });
});

describe("escalation", () => {
  const now = new Date("2026-09-06T12:00:00.000Z");
  it("waits slaDays at the Business Head, then at the functional head from the BH's decision", () => {
    expect(escalation(req({ raisedAt: "2026-09-04T09:00:00.000Z" }), L, now)).toBeNull();
    expect(escalation(req({ raisedAt: "2026-09-01T09:00:00.000Z" }), L, now)).toEqual({ stage: "bh", days: 5 });
    expect(escalation(req({ bh: ok("2026-09-05T09:00:00.000Z") }), L, now)).toBeNull();
    expect(escalation(req({ bh: ok("2026-09-02T09:00:00.000Z") }), L, now)).toEqual({ stage: "fn", days: 4 });
    expect(escalation(req({ bh: ok(), fn: ok() }), L, now)).toBeNull();
  });
});

describe("payment status", () => {
  const approved = { bh: ok(), fn: ok() };
  it("runs the advance through Accounts, then GM Finance and the Director above the limit", () => {
    const adv = (amount: number, extra: Partial<RequisitionDto> = {}) =>
      payStatus(req({ ...approved, estCost: 200000, advance: { required: true, amount, terms: "" }, ...extra }), L);
    expect(adv(20000)).toBe("advance_approval");
    expect(adv(20000, { advanceApproval: { ...ok(), decision: "held" } })).toBe("advance_approval");
    expect(adv(20000, { advanceApproval: ok() })).toBe("advance_to_pay");
    expect(adv(60000, { advanceApproval: ok() })).toBe("advance_finance");
    expect(adv(60000, { advanceApproval: ok(), advanceFinance: ok() })).toBe("advance_director");
    expect(adv(60000, { advanceApproval: ok(), advanceFinance: ok(), advanceDirector: ok() })).toBe("advance_to_pay");
    expect(adv(60000, { payments: { advance: { by: "U", at: "x", amount: 60000, mode: "NEFT", ref: "U1" }, balance: null } })).toBe("advance_paid");
  });

  it("verifies, re-approves an overrun, signs off, then pays the balance", () => {
    const after = (cost: number, extra: Partial<RequisitionDto> = {}, verified = true) =>
      payStatus(req({ ...approved, procurement: purchase(cost, verified), ...extra }), L);
    expect(after(40000, {}, false)).toBe("awaiting_verification");
    expect(after(43000)).toBe("variance_reapproval");
    expect(after(43000, { varianceApproval: { ...ok(), decision: "queried" } })).toBe("variance_reapproval");
    expect(after(42000)).toBe("finance_signoff");
    expect(after(42000, { financeApproval: ok() })).toBe("director_signoff");
    expect(after(9000, { financeApproval: ok() })).toBe("balance_to_pay");
    expect(after(42000, { financeApproval: ok(), directorApproval: ok() })).toBe("balance_to_pay");
    expect(after(42000, { payments: { advance: null, balance: { by: "U", at: "x", amount: 42000, mode: "NEFT", ref: "U2" } } })).toBe("settled");
  });

  it("is closed when rejected and not ready while pending", () => {
    expect(payStatus(req({ bh: { ...ok(), decision: "rejected" } }), L)).toBe("closed");
    expect(payStatus(req(), L)).toBe("not_ready");
  });

  it("works out the overrun and the balance due", () => {
    const r = req({ ...approved, procurement: purchase(46000), payments: { advance: { by: "U", at: "x", amount: 10000, mode: "NEFT", ref: "U" }, balance: null } });
    expect(variance(r, L)).toMatchObject({ over: 6000, pct: 15 });
    expect(balanceDue(r)).toBe(36000);
  });
});

describe("requisition requests", () => {
  const raise = { dealershipId: "D_MTB", deptId: "DEP_ADM", item: "Chairs", qty: 4, estCost: 40000, justification: "Worn out" };

  it("fills defaults and checks the advance against the estimate", () => {
    expect(raiseBody.parse(raise)).toMatchObject({ facilityId: null, expectedDelivery: null, advance: { required: false, amount: 0, terms: "" } });
    expect(raiseBody.safeParse({ ...raise, advance: { required: true, amount: 0 } }).success).toBe(false);
    expect(raiseBody.safeParse({ ...raise, advance: { required: true, amount: 50000 } }).success).toBe(false);
    expect(raiseBody.safeParse({ ...raise, qty: 1.5 }).success).toBe(false);
    expect(raiseBody.safeParse({ ...raise, ref: "REQ-2026-9999" }).success).toBe(false);
  });

  it("needs a reason for anything but approval", () => {
    expect(decisionBody.safeParse({ decision: "approved" }).success).toBe(true);
    expect(decisionBody.safeParse({ decision: "rejected", note: " " }).success).toBe(false);
    expect(verifyBody.safeParse({ decision: "sent_back" }).success).toBe(false);
  });

  it("takes a purchase without its placement, one line per asset", () => {
    const p = { purchaseDate: "2026-10-01", vendor: "Croma", assets: [{ category: "IT Equipment", name: "Laptop", cost: 60000 }] };
    expect(procureBody.parse(p)).toMatchObject({ invoiceNo: "", invoiceDoc: null, assets: [{ make: "", warranty: null, bundled: [], assignedTo: null }] });
    expect(procureBody.safeParse({ ...p, dealershipId: "D_MTB" }).success).toBe(false);
    expect(procureBody.safeParse({ ...p, assets: [] }).success).toBe(false);
    expect(procureBody.safeParse({ ...p, vendor: "" }).success).toBe(false);
  });

  it("records payments by a known mode with a reference", () => {
    expect(paymentBody.safeParse({ amount: 100, mode: "NEFT", ref: "UTR-1" }).success).toBe(true);
    expect(paymentBody.safeParse({ amount: 100, mode: "Barter", ref: "UTR-1" }).success).toBe(false);
    expect(paymentBody.safeParse({ amount: 100, mode: "NEFT", ref: "" }).success).toBe(false);
  });
});
