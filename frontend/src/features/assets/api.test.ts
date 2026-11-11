import { describe, expect, it } from "vitest";
import { toProcureBody, toRaiseBody } from "../requisitions/api";
import { bundledNames, invoiceDetails, toCreateBody } from "./api";

describe("request bodies", () => {
  it("maps the add-existing form: empty choices are null, bundled items a list", () => {
    expect(toCreateBody({
      category: "IT Equipment", name: "Laptop", make: "HP", model: "", serial: "", purchaseDate: "", cost: "58000",
      vendor: "", dealershipId: "D_JCB_NSK", facilityId: "", deptId: "DEP_IT", warranty: "", bundled: " Charger, ,Bag ",
      assignedTo: "", invoiceDoc: null,
    })).toEqual({
      category: "IT Equipment", name: "Laptop", make: "HP", model: "", serial: "", purchaseDate: null, cost: 58000,
      vendor: "", dealershipId: "D_JCB_NSK", facilityId: null, deptId: "DEP_IT", warranty: null,
      bundled: ["Charger", "Bag"], assignedTo: null, invoiceDoc: null,
    });
  });

  it("sends invoice details only, never the local file or line items", () => {
    expect(invoiceDetails({ fileName: "inv.pdf", fileUrl: "blob:x", fileType: "application/pdf", vendor: "Croma", invoiceDate: "2026-10-01", total: 62000, items: [] } as never))
      .toEqual({ fileName: "inv.pdf", vendor: "Croma", invoiceDate: "2026-10-01", total: 62000 });
    expect(invoiceDetails({ fileUrl: "blob:x" })).toBeNull();
    expect(invoiceDetails({ invoiceDate: "01/10/2026" })).toBeNull();
  });

  it("maps a requisition's procurement form; where it sits comes from the requisition on the server", () => {
    const body = toProcureBody({
      vendor: " Croma ", invoice: "CR/1", date: "2026-10-01", invoiceDoc: null,
      assets: [{ category: "IT Equipment", name: "PC", make: "", model: "", serial: "", cost: "48000", warranty: "", bundled: "Keyboard", assignedTo: "" }],
    });
    expect(body).toMatchObject({ vendor: "Croma", invoiceNo: "CR/1", purchaseDate: "2026-10-01" });
    expect(body).not.toHaveProperty("dealershipId");
    expect(body.assets[0]).toEqual({ category: "IT Equipment", name: "PC", make: "", model: "", serial: "", cost: 48000, warranty: null, bundled: ["Keyboard"], assignedTo: null });
  });

  it("maps the raise form: no advance means none at all", () => {
    const form = {
      dealershipId: "D_MTB", facilityId: "", deptId: "DEP_ADM", item: " Chairs ", qty: "4", estCost: "40000",
      justification: "Worn out", expectedDelivery: "", advance: { required: false, amount: 5000, terms: "x" },
    };
    expect(toRaiseBody(form)).toEqual({
      dealershipId: "D_MTB", facilityId: null, deptId: "DEP_ADM", item: "Chairs", qty: 4, estCost: 40000,
      justification: "Worn out", expectedDelivery: null, advance: { required: false, amount: 0, terms: "" },
    });
    expect(toRaiseBody({ ...form, advance: { required: true, amount: 5000, terms: " 30% " } }).advance).toEqual({ required: true, amount: 5000, terms: "30%" });
  });

  it("splits comma lists", () => {
    expect(bundledNames(null)).toEqual([]);
    expect(bundledNames("A,B , C")).toEqual(["A", "B", "C"]);
  });
});
