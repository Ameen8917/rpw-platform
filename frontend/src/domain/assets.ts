import { RESIDUAL_PCT } from "./config";
import { TODAY } from "../lib/format";
import { T } from "../theme";
import type { Accessory, Asset, AssetCategory, Dealership } from "../types";

/* Category → short code + Schedule II useful life (years).
   Confirm these against your auditor's fixed-asset policy before relying on book values. */
export const CATEGORY_META: Record<AssetCategory, { code: string; life: number }> = {
  "IT Equipment": { code: "IT", life: 3 },
  "IT – Servers & Network": { code: "SRV", life: 6 },
  "Diagnostic Equipment": { code: "DIA", life: 15 },
  "Workshop Equipment": { code: "WRK", life: 15 },
  "Machinery & Power": { code: "MCH", life: 15 },
  "Furniture & Fixtures": { code: "FUR", life: 10 },
  "Office Equipment": { code: "OFF", life: 5 },
  "Internal Vehicles": { code: "VEH", life: 8 },
};

export const CATEGORIES = Object.keys(CATEGORY_META) as AssetCategory[];

/* Financial year label for a date: Apr–Mar */
export function fyOf(iso?: string | null) {
  const d = new Date(iso || TODAY);
  const y = d.getFullYear(), m = d.getMonth() + 1;
  const start = m >= 4 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

/* Auto-generated asset code: RPW/JNS/IT/26-27/0007 — same format for every dealership and user */
export function genAssetCode(assets: Pick<Asset, "code">[], dealerships: Dealership[], dealershipId: string, category: string, date: string) {
  const dl = dealerships.find((d) => d.id === dealershipId);
  const prefix = `RPW/${dl?.short || "GEN"}/${CATEGORY_META[category]?.code || "GEN"}/${fyOf(date)}/`;
  const n = assets.filter((a) => a.code.startsWith(prefix)).length + 1;
  return prefix + String(n).padStart(4, "0");
}

/* Acceptance state of an issued asset */
export type CustodyState = "unissued" | "pending" | "accepted_app" | "accepted_signed";
export function custodyState(a: Asset): CustodyState {
  if (!a.assignedTo) return "unissued";
  if (!a.acceptance) return "pending";
  return a.acceptance.method === "in_app" ? "accepted_app" : "accepted_signed";
}

export const CUSTODY_LABEL = {
  unissued: { label: "Not issued", c: T.sub, bg: T.slateBg },
  pending: { label: "Acceptance pending", c: T.bad, bg: T.badBg },
  accepted_app: { label: "Accepted in app", c: T.ok, bg: T.okBg },
  accepted_signed: { label: "Signed at handover", c: T.ok, bg: T.okBg },
};

/* "Charger, Screen guard, Cover" -> bundled accessory records */
export function parseBundled(text: string | null | undefined, date: string): Accessory[] {
  return String(text || "").split(",").map((t) => t.trim()).filter(Boolean)
    .map((name) => ({ name, serial: "—", origin: "bundled" as const, cost: 0, addedAt: date, status: "with_asset" }));
}

/* Accessories are tracked, not capitalised separately: sub-code RPW/.../0007-A1 */
export function accessoryCode(parent: Pick<Asset, "code">, index: number) { return `${parent.code}-A${index + 1}`; }

/* Depreciation — Companies Act 2013 Schedule II, WDV, 5% residual.
   Returns accumulated depreciation and net book value as at today. */
export function depreciation(a: Pick<Asset, "category" | "purchaseDate" | "cost">, asOf: Date = TODAY) {
  const life = CATEGORY_META[a.category]?.life;
  if (!life || !a.purchaseDate || !a.cost) return null;
  const years = Math.max(0, (asOf.getTime() - new Date(a.purchaseDate).getTime()) / (365.25 * 86400000));
  const residual = a.cost * (RESIDUAL_PCT / 100);
  const rate = 1 - Math.pow(residual / a.cost, 1 / life);
  const elapsed = Math.min(years, life);
  const nbv = Math.max(residual, a.cost * Math.pow(1 - rate, elapsed));
  return {
    life, rate: rate * 100, years,
    residual, nbv,
    accumulated: a.cost - nbv,
    fullyDepreciated: years >= life,
  };
}

export const ASSET_STATUS = {
  in_use: { label: "In use", c: T.ok, bg: T.okBg },
  in_storage: { label: "In storage", c: T.slate, bg: T.slateBg },
  under_repair: { label: "Under repair", c: T.warn, bg: T.warnBg },
  disposed: { label: "Disposed", c: T.bad, bg: T.badBg },
};

let tagSeq = 100000;

/* Prototype factory: fills defaults and a sequential short tag. The backend assigns these in production. */
export function mkAsset(o: Partial<Asset> & Pick<Asset, "code" | "name" | "category" | "cost" | "dealershipId">): Asset {
  tagSeq += 1;
  return { id: o.code, source: "existing", status: "in_use", assignedTo: null, facilityId: null, deptId: null, tagId: String(tagSeq),
    make: "", model: "", serial: "", purchaseDate: "", vendor: "", warranty: null, ...o };
}

/* Label sizes. Small and micro encode the short numeric tag ID rather than the full
   code — a 22-character code cannot print below ~56mm and still scan. */
export const LABEL_SIZES = {
  standard: { label: "Standard", note: "~56 mm wide · machinery, furniture, workshop equipment", width: 260, module: 1.3, barH: 38, full: true, detail: true },
  small: { label: "Small", note: "~26 mm wide · laptops, tablets, small equipment", width: 150, module: 1.1, barH: 28, full: false, detail: true },
  micro: { label: "Micro", note: "~17 mm wide · phones, accessories, anything narrow", width: 104, module: 0.9, barH: 22, full: false, detail: false },
};
