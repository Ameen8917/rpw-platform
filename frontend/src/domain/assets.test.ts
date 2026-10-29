import { describe, expect, it } from "vitest";
import { accessoryCode, custodyState, depreciation, fyOf, genAssetCode, mkAsset, parseBundled } from "./assets";
import { SEED_DEALERSHIPS } from "../data/seed";
import { code128Runs } from "../lib/barcode";

const base = { code: "X", name: "Laptop", category: "IT Equipment" as const, cost: 60000, dealershipId: "D_JCB_NSK" };

describe("fyOf", () => {
  it("labels April–March financial years", () => {
    expect(fyOf("2026-04-01")).toBe("26-27");
    expect(fyOf("2027-03-31")).toBe("26-27");
    expect(fyOf("2026-03-31")).toBe("25-26");
  });
});

describe("genAssetCode", () => {
  it("builds RPW/<dealer>/<category>/<FY>/<seq> and increments per prefix", () => {
    const first = genAssetCode([], SEED_DEALERSHIPS, "D_JCB_NSK", "IT Equipment", "2026-08-12");
    expect(first).toBe("RPW/JNS/IT/26-27/0001");
    const second = genAssetCode([{ code: first }], SEED_DEALERSHIPS, "D_JCB_NSK", "IT Equipment", "2026-08-12");
    expect(second).toBe("RPW/JNS/IT/26-27/0002");
  });
  it("falls back to GEN for unknown dealership or category", () => {
    expect(genAssetCode([], SEED_DEALERSHIPS, "nope", "Nope", "2026-08-12")).toBe("RPW/GEN/GEN/26-27/0001");
  });
});

describe("depreciation (Schedule II WDV, 5% residual)", () => {
  it("returns null without cost, date or known category", () => {
    expect(depreciation({ category: "IT Equipment", purchaseDate: "", cost: 1000 })).toBeNull();
  });
  it("reaches the residual value at end of useful life and never goes below it", () => {
    const d = depreciation({ category: "IT Equipment", purchaseDate: "2020-01-01", cost: 100000 })!;
    expect(d.fullyDepreciated).toBe(true);
    expect(d.nbv).toBeCloseTo(5000, 6);
    expect(d.accumulated).toBeCloseTo(95000, 6);
  });
  it("uses the WDV rate that lands on residual after `life` years", () => {
    const d = depreciation({ category: "IT Equipment", purchaseDate: "2026-09-06", cost: 100000 })!;
    expect(d.nbv).toBe(100000);
    expect(Math.pow(1 - d.rate / 100, d.life)).toBeCloseTo(0.05, 10);
  });
});

describe("custody", () => {
  it("derives custody state from assignment and acceptance", () => {
    expect(custodyState(mkAsset(base))).toBe("unissued");
    expect(custodyState(mkAsset({ ...base, assignedTo: "U_NIL" }))).toBe("pending");
    expect(custodyState(mkAsset({ ...base, assignedTo: "U_NIL", acceptance: { method: "in_app", at: "", snapshot: [] } }))).toBe("accepted_app");
    expect(custodyState(mkAsset({ ...base, assignedTo: "U_NIL", acceptance: { method: "signature", at: "", snapshot: [] } }))).toBe("accepted_signed");
  });
});

describe("accessories", () => {
  it("parses a comma list into bundled accessories", () => {
    const acc = parseBundled(" Charger, , Screen guard ", "2026-09-01");
    expect(acc.map((a) => a.name)).toEqual(["Charger", "Screen guard"]);
    expect(acc.every((a) => a.origin === "bundled" && a.cost === 0)).toBe(true);
  });
  it("numbers accessory sub-codes from A1", () => {
    expect(accessoryCode({ code: "RPW/JNS/IT/26-27/0007" }, 0)).toBe("RPW/JNS/IT/26-27/0007-A1");
  });
});

describe("code128Runs", () => {
  it("emits 11 modules per symbol plus the 2-module final bar", () => {
    const text = "RPW-IT-0142";                      // code set B: start + 11 chars + check + stop
    const total = code128Runs(text).reduce((s, r) => s + r.w, 0);
    expect(total).toBe((1 + text.length + 1 + 1) * 11 + 2);
  });
  it("packs even-length numeric tags two digits per symbol (code set C)", () => {
    const total = code128Runs("100011").reduce((s, r) => s + r.w, 0);
    expect(total).toBe((1 + 3 + 1 + 1) * 11 + 2);
  });
});
