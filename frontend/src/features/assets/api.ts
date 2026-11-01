import { api } from "../../lib/api";
import type { Asset, AttachmentKind, Department, Dealership, Facility, InvoiceDoc, Requisition, User } from "../../types";

/* Asset Management and the reference data it needs, read and written through the API.
   The request bodies here are the backend's Zod contracts (docs/asset-management.md, section 6). */

export interface OrgData {
  users: User[];
  dealerships: Dealership[];
  facilities: Facility[];
  departments: Department[];
}

export const orgApi = {
  async load(): Promise<OrgData> {
    const [users, dealerships, facilities, departments] = await Promise.all([
      api.get<User[]>("/org/users"),
      api.get<Dealership[]>("/org/dealerships"),
      api.get<Facility[]>("/org/facilities"),
      api.get<Department[]>("/org/departments"),
    ]);
    return { users, dealerships, facilities, departments };
  },
};

/** What the API returns for one requisition's purchase */
export interface ProcurementResult {
  reqRef: string;
  by: string;
  at: string;
  actualCost: number;
  vendor: string;
  invoice: string;
  invoiceDoc: InvoiceDoc | null;
  verified: boolean;
  assetCodes: string[];
  assets: Asset[];
}

const id = encodeURIComponent;

export const assetApi = {
  list: () => api.get<Asset[]>("/assets"),
  get: (assetId: string) => api.get<Asset>(`/assets/${id(assetId)}`),
  create: (body: ReturnType<typeof toCreateBody>) => api.post<Asset>("/assets", body),
  procure: (body: ReturnType<typeof toProcuredBody>) => api.post<ProcurementResult>("/assets/procured", body),
  issue: (assetId: string, d: { who: string; method: "in_app" | "signature"; signature?: string | null; note?: string }) =>
    api.post<Asset>(`/assets/${id(assetId)}/issue`, {
      userId: d.who, method: d.method, note: d.note?.trim() || undefined,
      ...(d.method === "signature" ? { signature: d.signature } : {}),
    }),
  accept: (assetId: string) => api.post<Asset>(`/assets/${id(assetId)}/accept`),
  recordReturn: (assetId: string, d: { signature: string; condition: string; missing: string[] }) =>
    api.post<Asset>(`/assets/${id(assetId)}/return`, d),
  addAccessory: (assetId: string, acc: { name: string; origin: "bundled" | "separate"; cost?: number; addedAt?: string; serial?: string }) =>
    api.post<Asset>(`/assets/${id(assetId)}/accessories`, acc.origin === "bundled"
      ? { name: acc.name, origin: "bundled", serial: acc.serial ?? "" }
      : { name: acc.name, origin: "separate", cost: Number(acc.cost), addedAt: acc.addedAt || null, serial: acc.serial ?? "" }),
  dispose: (assetId: string, reason: string, scrap: string | number | null) =>
    api.post<Asset>(`/assets/${id(assetId)}/dispose`, {
      reason, scrapValue: scrap === "" || scrap === null || scrap === undefined ? null : Number(scrap),
    }),
  /* The file is the request body; what it is goes in the query string */
  attach: (assetId: string, file: Blob, d: { kind: AttachmentKind; name: string; caption?: string }) =>
    api.upload<Asset>(`/assets/${id(assetId)}/attachments?${new URLSearchParams({
      kind: d.kind, name: d.name.slice(0, 200) || "file", ...(d.caption?.trim() ? { caption: d.caption.trim().slice(0, 200) } : {}),
    })}`, file),
  removeAttachment: (assetId: string, attachmentId: string) =>
    api.post<Asset>(`/assets/${id(assetId)}/attachments/${id(attachmentId)}/remove`),
};

/* "Charger, Screen guard" → ["Charger", "Screen guard"] */
export const bundledNames = (text: string | null | undefined) =>
  String(text || "").split(",").map((t) => t.trim()).filter(Boolean);

/* The invoice reader also returns the file (a local data URL) and its line items. Only the
   details go with the asset; the file itself is uploaded afterwards as an attachment. */
export function invoiceDetails(doc: InvoiceDoc | null | undefined): InvoiceDoc | null {
  if (!doc) return null;
  const out: InvoiceDoc = {};
  if (doc.fileName) out.fileName = String(doc.fileName).slice(0, 200);
  if (doc.vendor) out.vendor = String(doc.vendor).slice(0, 200);
  if (doc.invoiceNo) out.invoiceNo = String(doc.invoiceNo).slice(0, 100);
  if (doc.invoiceDate && /^\d{4}-\d{2}-\d{2}$/.test(String(doc.invoiceDate))) out.invoiceDate = String(doc.invoiceDate);
  if (typeof doc.total === "number" && doc.total >= 0) out.total = doc.total;
  return Object.keys(out).length ? out : null;
}

/** The "Add existing asset" form → POST /api/assets */
export function toCreateBody(f: {
  category: string; name: string; make: string; model: string; serial: string; purchaseDate: string; cost: string | number;
  vendor: string; dealershipId: string; facilityId: string; deptId: string; warranty: string; bundled: string;
  assignedTo: string | null; invoiceDoc?: InvoiceDoc | null;
}) {
  return {
    category: f.category, name: f.name, make: f.make, model: f.model, serial: f.serial,
    purchaseDate: f.purchaseDate || null, cost: Number(f.cost), vendor: f.vendor,
    dealershipId: f.dealershipId, facilityId: f.facilityId || null, deptId: f.deptId || null,
    warranty: f.warranty || null, bundled: bundledNames(f.bundled), assignedTo: f.assignedTo || null,
    invoiceDoc: invoiceDetails(f.invoiceDoc),
  };
}

/** The "Record procurement" form of a requisition → POST /api/assets/procured */
export function toProcuredBody(r: Pick<Requisition, "ref" | "dealershipId" | "facilityId" | "deptId">, form: {
  vendor: string; invoice: string; date: string; invoiceDoc?: InvoiceDoc | null;
  assets: { category: string; name: string; make: string; model: string; serial: string; cost: string | number; warranty: string; bundled: string; assignedTo: string }[];
}) {
  return {
    reqRef: r.ref, dealershipId: r.dealershipId, facilityId: r.facilityId || null, deptId: r.deptId || null,
    purchaseDate: form.date, vendor: form.vendor.trim(), invoiceNo: form.invoice.trim(),
    invoiceDoc: invoiceDetails(form.invoiceDoc),
    assets: form.assets.map((a) => ({
      category: a.category, name: a.name, make: a.make, model: a.model, serial: a.serial, cost: Number(a.cost),
      warranty: a.warranty || null, bundled: bundledNames(a.bundled), assignedTo: a.assignedTo || null,
    })),
  };
}
