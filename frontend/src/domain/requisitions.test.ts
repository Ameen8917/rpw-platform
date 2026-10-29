import { describe, expect, it } from "vitest";
import { SEED_REQS } from "../data/seed";
import { payStatus } from "./payments";
import { escalation, reqStatus } from "./requisitions";

const byRef = (ref: string) => SEED_REQS.find((r) => r.ref === ref)!;

describe("reqStatus", () => {
  it("derives status from approvals and procurement", () => {
    expect(reqStatus(byRef("REQ-2026-0027"))).toBe("procured");
    expect(reqStatus(byRef("REQ-2026-0030"))).toBe("rejected");   // functional head rejected
    expect(reqStatus(byRef("REQ-2026-0034"))).toBe("pending");    // no approvals yet
    expect(reqStatus(byRef("REQ-2026-0019"))).toBe("approved");   // under Director purchase threshold
  });
  it("holds above-threshold purchases until the Director approves", () => {
    const r = { ...byRef("REQ-2026-0036"), directorPurchase: undefined };
    expect(reqStatus(r)).toBe("pending");
  });
});

describe("escalation", () => {
  it("flags approver silence at or beyond the SLA, measured from the previous stage", () => {
    expect(escalation(byRef("REQ-2026-0034"))).toBeNull();                      // raised 2 days ago
    expect(escalation(byRef("REQ-2026-0033"))).toEqual({ stage: "fn", days: 3 }); // BH acted 3 days ago
  });
});

describe("payStatus", () => {
  it("tracks settlement and the advance path", () => {
    expect(payStatus(byRef("REQ-2026-0027"))).toBe("settled");
    expect(payStatus(byRef("REQ-2026-0024"))).toBe("advance_paid");
    expect(payStatus(byRef("REQ-2026-0036"))).toBe("advance_finance");  // ₹58k advance > ₹50k escalation limit
    expect(payStatus(byRef("REQ-2026-0030"))).toBe("closed");
  });
});
