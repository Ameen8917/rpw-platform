import { describe, expect, it } from "vitest";
import { SEED_ASSETS, SEED_REQS } from "../data/seed";
import { mkAsset } from "./assets";
import {
  approvalStage, approvalsByStage, custodyBreakdown, custodyGroup, monthLabel, monthWindow, niceTicks,
  paymentPhases, purchasesOf, rankBy, spendByMonth,
} from "./dashboard";
import { dueAmount, payStatus } from "./payments";
import { escalation, reqStatus } from "./requisitions";

describe("operations overview", () => {
  it("places each pending requisition at the stage it waits on, and counts overdue ones", () => {
    const rows = approvalsByStage(SEED_REQS);
    const staged = SEED_REQS.filter((r) => approvalStage(r));
    expect(rows.reduce((s, r) => s + r.onTime + r.overdue, 0)).toBe(staged.length);
    expect(rows.reduce((s, r) => s + r.overdue, 0)).toBe(staged.filter((r) => escalation(r)).length);
    for (const r of SEED_REQS) if (reqStatus(r) !== "pending") expect(approvalStage(r)).toBeNull();
  });

  it("splits money in the payment process into approval, ready to pay and advances out", () => {
    const [approval, toPay, advanceOut] = paymentPhases(SEED_REQS);
    const due = (states: string[]) => SEED_REQS.filter((r) => states.includes(payStatus(r))).reduce((s, r) => s + dueAmount(r), 0);
    expect(toPay.amount).toBe(due(["advance_to_pay", "balance_to_pay"]));
    expect(approval.count).toBe(SEED_REQS.filter((r) => ["advance_approval", "advance_finance", "advance_director", "awaiting_verification", "variance_reapproval", "finance_signoff", "director_signoff"].includes(payStatus(r))).length);
    expect(advanceOut.count).toBe(SEED_REQS.filter((r) => payStatus(r) === "advance_paid").length);
  });

  it("groups live assets by custody, with repair taking precedence and disposed left out", () => {
    const base = { code: "X", name: "X", category: "IT Equipment" as const, cost: 1, dealershipId: "D1" };
    expect(custodyGroup(mkAsset({ ...base, status: "under_repair", assignedTo: "U1" }))).toBe("repair");
    expect(custodyGroup(mkAsset({ ...base, assignedTo: "U1", acceptance: null }))).toBe("awaiting");
    expect(custodyGroup(mkAsset({ ...base, assignedTo: null }))).toBe("storage");
    expect(custodyGroup(mkAsset({ ...base, status: "disposed" }))).toBeNull();
    const live = SEED_ASSETS.filter((a) => a.status !== "disposed").length;
    expect(custodyBreakdown(SEED_ASSETS).reduce((s, g) => s + g.count, 0)).toBe(live);
  });
});

describe("dashboard aggregations", () => {
  it("builds a month window across a year boundary, oldest first", () => {
    expect(monthWindow("2026-02", 4)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
    expect(monthLabel("2026-08")).toBe("Aug");
    expect(monthLabel("2026-08", true)).toBe("Aug 2026");
  });

  it("sums spend per month, with empty months as zero", () => {
    const p = purchasesOf([
      { id: "a", dealershipId: "D1", procurement: { at: "2026-07-03T10:00:00Z", actualCost: 1000 } },
      { id: "b", dealershipId: "D2", procurement: { at: "2026-07-20", actualCost: 500 } },
      { id: "c", dealershipId: "D1", procurement: { at: "2026-09-01", actualCost: 200 } },
      { id: "d", dealershipId: "D1", procurement: null },
    ]);
    expect(p).toHaveLength(3);
    expect(spendByMonth(p, ["2026-07", "2026-08", "2026-09"])).toEqual([
      { month: "2026-07", spend: 1500, count: 2 },
      { month: "2026-08", spend: 0, count: 0 },
      { month: "2026-09", spend: 200, count: 1 },
    ]);
  });

  it("ranks totals and folds the tail into Other", () => {
    const items = ["a", "b", "c", "d"].map((key, i) => ({ key, value: (i + 1) * 10 }));
    expect(rankBy(items, 6).map((r) => r.key)).toEqual(["d", "c", "b", "a"]);
    const folded = rankBy(items, 3);
    expect(folded.map((r) => r.key)).toEqual(["d", "c", "__other"]);
    expect(folded[2]).toMatchObject({ value: 30, others: 2 });
  });

  it("makes round ticks that reach the maximum", () => {
    expect(niceTicks(0)).toEqual([0]);
    expect(niceTicks(9)).toEqual([0, 2.5, 5, 7.5, 10]);
    const t = niceTicks(1_730_000);
    expect(t[0]).toBe(0);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(1_730_000);
    expect(t).toEqual([0, 500_000, 1_000_000, 1_500_000, 2_000_000]);
  });
});
