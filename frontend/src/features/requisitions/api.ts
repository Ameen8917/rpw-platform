import { api } from "../../lib/api";
import type { Asset, Department, Dealership, Facility, Requisition, User } from "../../types";
import { bundledNames, invoiceDetails } from "../assets/api";
import type { LIMITS } from "../../domain/config";

/* Requisitions, payments, group settings and the Admin console, through the API
   (docs/requisitions.md, section 6). Every action answers with the updated requisition. */

const id = encodeURIComponent;

export type Limits = typeof LIMITS;
export type StageKey = "bh" | "fn" | "directorPurchase" | "advanceApproval" | "advanceFinance" | "advanceDirector"
  | "varianceApproval" | "financeApproval" | "directorApproval";
export type StageDecision = "approved" | "rejected" | "held" | "queried";

export const reqApi = {
  list: () => api.get<Requisition[]>("/requisitions"),
  raise: (body: ReturnType<typeof toRaiseBody>) => api.post<Requisition>("/requisitions", body),
  decide: (reqId: string, stage: StageKey, decision: StageDecision, note: string) =>
    api.post<Requisition>(`/requisitions/${id(reqId)}/decisions/${stage}`, { decision, note: note.trim() }),
  resubmit: (reqId: string, draft: { item: string; qty: number; estCost: number; justification: string; expectedDelivery: string }) =>
    api.post<Requisition>(`/requisitions/${id(reqId)}/resubmit`, {
      item: draft.item.trim(), qty: Number(draft.qty), estCost: Number(draft.estCost),
      justification: draft.justification.trim(), expectedDelivery: draft.expectedDelivery || null,
    }),
  procure: (reqId: string, body: ReturnType<typeof toProcureBody>) =>
    api.post<{ requisition: Requisition; assets: Asset[] }>(`/requisitions/${id(reqId)}/procure`, body),
  verify: (reqId: string, decision: "verified" | "sent_back", note: string) =>
    api.post<Requisition>(`/requisitions/${id(reqId)}/verify`, { decision, note: note.trim() }),
  pay: (reqId: string, kind: "advance" | "balance", form: { amount: string | number; mode: string; ref: string }) =>
    api.post<Requisition>(`/requisitions/${id(reqId)}/payments/${kind}`, { amount: Number(form.amount), mode: form.mode, ref: form.ref.trim() }),
};

export const settingsApi = {
  get: () => api.get<Limits>("/settings"),
  save: (limits: Limits) => api.put<Limits>("/settings", limits),
};

export const adminApi = {
  addDealership: (d: { name: string; short: string; brand: string; code: string; headId: string; territory: string }) =>
    api.post<Dealership>("/org/dealerships", {
      name: d.name.trim(), short: d.short.trim(), brand: d.brand.trim(), code: d.code.trim(), headId: d.headId || null,
      territory: d.territory.split(",").map((s) => s.trim()).filter(Boolean),
    }),
  addFacility: (f: { dealershipId: string; name: string; type: string; district: string }) =>
    api.post<Facility>("/org/facilities", { ...f, name: f.name.trim(), district: f.district.trim() }),
  addDepartment: (d: { name: string; dualAuthority: boolean; functionalHeadId: string | null }) =>
    api.post<Department>("/org/departments", { ...d, name: d.name.trim(), functionalHeadId: d.dualAuthority ? d.functionalHeadId || null : null }),
  setActive: (kind: "dealerships" | "facilities" | "departments", recordId: string, active: boolean) =>
    api.patch<Dealership | Facility | Department>(`/org/${kind}/${id(recordId)}`, { active }),
  addPerson: (p: { name: string; empCode: string; title: string; dealershipId: string; facilityId: string | null; deptId: string | null; role: string; password?: string }) =>
    api.post<User>("/org/users", { ...p, ...(p.role === "staff" ? { password: undefined } : {}) }),
  addPeople: (b: { dealershipId: string; facilityId: string | null; deptId: string | null; people: { name: string; empCode: string; title: string }[] }) =>
    api.post<User[]>("/org/users/bulk", b),
  setAuthority: (userId: string, a: { role: string; deptId: string | null; dealershipIds: string[]; approvalLimit: number | null }) =>
    api.patch<User>(`/org/users/${id(userId)}`, a),
  handover: (userId: string, successorId: string, revoke: boolean) =>
    api.post<{ leaver: User; successor: User }>(`/org/users/${id(userId)}/handover`, { successorId, revoke }),
};

/** The "Raise a requisition" form → POST /api/requisitions */
export function toRaiseBody(d: {
  dealershipId: string; facilityId: string; deptId: string; item: string; qty: number | string; estCost: number | string;
  justification: string; expectedDelivery: string; advance: { required: boolean; amount: number; terms: string };
}) {
  return {
    dealershipId: d.dealershipId, facilityId: d.facilityId || null, deptId: d.deptId,
    item: d.item.trim(), qty: Number(d.qty), estCost: Number(d.estCost), justification: d.justification.trim(),
    expectedDelivery: d.expectedDelivery || null,
    advance: d.advance.required
      ? { required: true, amount: Number(d.advance.amount), terms: d.advance.terms.trim() }
      : { required: false, amount: 0, terms: "" },
  };
}

/** The "Record procurement" form → POST /api/requisitions/:id/procure (placement comes from the requisition) */
export function toProcureBody(form: {
  vendor: string; invoice: string; date: string; invoiceDoc?: Parameters<typeof invoiceDetails>[0];
  assets: { category: string; name: string; make: string; model: string; serial: string; cost: string | number; warranty: string; bundled: string; assignedTo: string }[];
}) {
  return {
    purchaseDate: form.date, vendor: form.vendor.trim(), invoiceNo: form.invoice.trim(),
    invoiceDoc: invoiceDetails(form.invoiceDoc),
    assets: form.assets.map((a) => ({
      category: a.category, name: a.name.trim(), make: a.make, model: a.model, serial: a.serial, cost: Number(a.cost),
      warranty: a.warranty || null, bundled: bundledNames(a.bundled), assignedTo: a.assignedTo || null,
    })),
  };
}
