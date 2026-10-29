import { describe, expect, it } from "vitest";
import type { AuthContext } from "../auth/auth.service.js";
import { permissionsFor } from "../auth/permissions.js";
import type { UserDto } from "../org/org.dto.js";
import {
  accessoryCode, assetCode, assetCodePrefix, assetScope, depreciation, fyOf, inScope, todayIST,
} from "./asset-rules.js";
import { createAssetBody, lookupQuery } from "./assets.schemas.js";

describe("asset codes", () => {
  it("labels the April–March financial year", () => {
    expect(fyOf("2026-03-31")).toBe("25-26");
    expect(fyOf("2026-04-01")).toBe("26-27");
    expect(fyOf("2099-12-31")).toBe("99-00");
  });

  it("builds RPW/<short>/<category>/<FY>/<NNNN>", () => {
    const prefix = assetCodePrefix("JNS", "IT Equipment", "2026-09-06");
    expect(prefix).toBe("RPW/JNS/IT/26-27/");
    expect(assetCode(prefix, 7)).toBe("RPW/JNS/IT/26-27/0007");
    expect(assetCode(assetCodePrefix("COR", "IT – Servers & Network", "2027-01-10"), 12)).toBe("RPW/COR/SRV/26-27/0012");
    expect(accessoryCode("RPW/JNS/IT/26-27/0007", 2)).toBe("RPW/JNS/IT/26-27/0007-A2");
  });

  it("takes today's date in India, not UTC", () => {
    /* 31 March 20:00 UTC is already 1 April in India: a new financial year */
    expect(todayIST(new Date("2026-03-31T20:00:00Z"))).toBe("2026-04-01");
    expect(todayIST(new Date("2026-03-31T18:00:00Z"))).toBe("2026-03-31");
  });
});

describe("depreciation (Schedule II, WDV, 5% residual)", () => {
  it("matches the prototype's figures for a 3-year IT asset", () => {
    const d = depreciation({ category: "IT Equipment", purchaseDate: "2024-07-15", cost: 62000 }, "2026-09-06")!;
    expect(d.life).toBe(3);
    expect(d.rate).toBeCloseTo(63.16, 2);
    expect(d.years).toBeCloseTo(783 / 365.25, 9);
    expect(d.nbv).toBeCloseTo(62000 * Math.pow(0.05, d.years / 3), 6);
    expect(d.accumulated).toBeCloseTo(62000 - d.nbv, 6);
    expect(d.fullyDepreciated).toBe(false);
  });

  it("stops at the residual value once the useful life is complete", () => {
    const d = depreciation({ category: "IT Equipment", purchaseDate: "2020-01-01", cost: 100000 }, "2026-09-06")!;
    expect(d.nbv).toBeCloseTo(5000, 6);
    expect(d.fullyDepreciated).toBe(true);
  });

  it("is full value on the purchase date and null without a date or cost", () => {
    expect(depreciation({ category: "Furniture & Fixtures", purchaseDate: "2026-09-06", cost: 1000 }, "2026-09-06")!.nbv).toBe(1000);
    expect(depreciation({ category: "Furniture & Fixtures", purchaseDate: null, cost: 1000 }, "2026-09-06")).toBeNull();
    expect(depreciation({ category: "Furniture & Fixtures", purchaseDate: "2026-01-01", cost: 0 }, "2026-09-06")).toBeNull();
  });
});

describe("asset visibility", () => {
  const ctx = (role: UserDto["role"], dealershipIds: string[]): AuthContext => {
    const user = { id: "U", role, deptId: null, grants: [], dealershipIds } as unknown as UserDto;
    return { user, permissions: permissionsFor(user) };
  };

  it("shows the Director and corporate functional heads everything", () => {
    expect(assetScope(ctx("director", ["D_CORP"]))).toEqual({ all: true });
    expect(assetScope(ctx("functional_head", ["D_CORP"]))).toEqual({ all: true });
  });

  it("limits everyone else to their dealerships", () => {
    const bh = assetScope(ctx("business_head", ["D_CL", "D_HMSI"]));
    expect(inScope(bh, "D_HMSI")).toBe(true);
    expect(inScope(bh, "D_MTB")).toBe(false);
    expect(assetScope(ctx("manager", ["D_JCB_NSK"]))).toEqual({ all: false, dealershipIds: ["D_JCB_NSK"] });
    expect(inScope(assetScope(ctx("staff", [])), "D_JCB_NSK")).toBe(false);
  });
});

describe("add existing asset request", () => {
  const minimal = { category: "IT Equipment", name: "Laptop", cost: 50000, dealershipId: "D_JCB_NSK" };

  it("fills defaults and treats empty form values as none", () => {
    const parsed = createAssetBody.parse({ ...minimal, name: "  Laptop ", facilityId: "", deptId: "", purchaseDate: "", warranty: null });
    expect(parsed).toMatchObject({
      name: "Laptop", make: "", model: "", serial: "", vendor: "", bundled: [],
      facilityId: null, deptId: null, purchaseDate: null, warranty: null, assignedTo: null, invoiceDoc: null,
    });
  });

  it("requires name and a positive cost, and rejects unknown categories and fields", () => {
    expect(createAssetBody.safeParse({ ...minimal, name: " " }).success).toBe(false);
    expect(createAssetBody.safeParse({ ...minimal, cost: 0 }).success).toBe(false);
    expect(createAssetBody.safeParse({ ...minimal, cost: "50000" }).success).toBe(false);
    expect(createAssetBody.safeParse({ ...minimal, category: "Toys" }).success).toBe(false);
    /* the server generates these */
    expect(createAssetBody.safeParse({ ...minimal, code: "RPW/JNS/IT/26-27/0001" }).success).toBe(false);
    expect(createAssetBody.safeParse({ ...minimal, tagId: "1" }).success).toBe(false);
  });

  it("accepts only real calendar dates", () => {
    expect(createAssetBody.safeParse({ ...minimal, purchaseDate: "2026-02-28" }).success).toBe(true);
    expect(createAssetBody.safeParse({ ...minimal, purchaseDate: "2026-02-30" }).success).toBe(false);
    expect(createAssetBody.safeParse({ ...minimal, purchaseDate: "06/09/2026" }).success).toBe(false);
  });

  it("does not accept invoice files inline", () => {
    expect(createAssetBody.safeParse({ ...minimal, invoiceDoc: { vendor: "HP", fileUrl: "data:image/png;base64,AAAA" } }).success).toBe(false);
  });

  it("needs something to look up", () => {
    expect(lookupQuery.safeParse({ code: "  " }).success).toBe(false);
  });
});
