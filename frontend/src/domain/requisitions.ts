import { LIMITS } from "./config";
import { TODAY } from "../lib/format";
import { T } from "../theme";
import type { Dealership, Department, Requisition, User } from "../types";

export const REQ_STATUS = {
  pending: { label: "Awaiting approval", c: T.warn, bg: T.warnBg },
  approved: { label: "Approved – to procure", c: T.primary, bg: T.primarySoft },
  rejected: { label: "Rejected", c: T.bad, bg: T.badBg },
  procured: { label: "Procured", c: T.ok, bg: T.okBg },
};

/* Does this purchase need Director approval before it can be bought?
   Corporate requisitions are excluded — the Director already signs there as Business Head. */
export function needsDirectorPurchase(r: Requisition, approvers?: (User | undefined)[]) {
  if (r.dealershipId === "D_CORP") return false;
  if (r.estCost > LIMITS.purchaseDirector) return true;
  /* A personal approval limit pulls the Director in even below the group threshold */
  if (approvers) {
    const capped = approvers.find((u) => u && u.approvalLimit && r.estCost > u.approvalLimit);
    if (capped) return true;
  }
  return false;
}

/* Derived requisition status */
export type ReqStatus = "pending" | "approved" | "rejected" | "procured";
export function reqStatus(r: Requisition): ReqStatus {
  if (r.bh.decision === "rejected" || r.fn.decision === "rejected" || r.directorPurchase?.decision === "rejected") return "rejected";
  if (r.procurement) return "procured";
  const twoIn = r.bh.decision === "approved" && r.fn.decision === "approved";
  if (!twoIn) return "pending";
  if (needsDirectorPurchase(r) && r.directorPurchase?.decision !== "approved") return "pending";
  return "approved";
}

/* Approver silence: who is holding this up, and for how long */
export type Stage = "bh" | "fn";
export function escalation(r: Requisition): { stage: Stage; days: number } | null {
  if (reqStatus(r) !== "pending") return null;
  const daysSince = (iso: string) => Math.floor((TODAY.getTime() - new Date(iso).getTime()) / 86400000);
  if (!r.bh.decision) {
    const d = daysSince(r.raisedAt);
    return d >= LIMITS.slaDays ? { stage: "bh", days: d } : null;
  }
  if (!r.fn.decision) {
    const d = daysSince(r.bh.at);
    return d >= LIMITS.slaDays ? { stage: "fn", days: d } : null;
  }
  if (needsDirectorPurchase(r) && !r.directorPurchase?.decision) return null; // already with Director
  return null;
}

/* Who owns the approval at a given stage */
export function stageApprover(r: Requisition, stage: string, dealerships: Dealership[], departments: Department[]) {
  if (stage === "bh") {
    const dl = dealerships.find((d) => d.id === r.dealershipId);
    return dl?.isCorporate ? "U_ARJ" : dl?.headId;
  }
  return departments.find((d) => d.id === r.deptId)?.functionalHeadId;
}

/* Total approvals each person has been responsible for — the denominator for a fair late rate.
   Counts every stage they own, whether they acted, are still holding it, or the Director stepped in. */
export function approvalLoad(reqs: Requisition[], dealerships: Dealership[], departments: Department[]) {
  const load: Record<string, number> = {};
  const bump = (id: string | null | undefined) => { if (id) load[id] = (load[id] || 0) + 1; };
  reqs.forEach((r) => {
    ["bh", "fn"].forEach((stage) => {
      const owner = stageApprover(r, stage, dealerships, departments);
      const slot = r[stage];
      /* Skip stages not yet reached: a functional approval isn't owed until the BH has acted */
      if (stage === "fn" && !r.bh?.decision) return;
      if (slot?.decision || slot?.onBehalfOf || reqStatus(r) === "pending") bump(owner);
    });
  });
  return load;
}

/* Every instance where an approval ran past SLA — live or already covered by the Director */
export interface EscalationRecord {
  r: Requisition; stage: Stage; ownerId: string | null | undefined; days: number | undefined;
  actedBy?: string | null; at?: string | null; state: "covered" | "open";
}
export function escalationRecords(reqs: Requisition[], dealerships: Dealership[], departments: Department[]): EscalationRecord[] {
  const out: EscalationRecord[] = [];
  reqs.forEach((r) => {
    (["bh", "fn"] as const).forEach((stage) => {
      const slot = r[stage];
      if (slot?.onBehalfOf) {
        out.push({ r, stage, ownerId: slot.onBehalfOf, days: slot.lateDays, actedBy: slot.by, at: slot.at, state: "covered" });
      }
    });
    const e = escalation(r);
    if (e) out.push({ r, stage: e.stage, ownerId: stageApprover(r, e.stage, dealerships, departments), days: e.days, state: "open" });
  });
  return out.sort((a, b) => (b.days || 0) - (a.days || 0));
}

/* Actual cost overrun beyond tolerance */
export function variance(r: Requisition) {
  if (!r.procurement) return null;
  const over = r.procurement.actualCost - r.estCost;
  const pct = (over / r.estCost) * 100;
  return pct > LIMITS.variancePct ? { over, pct } : null;
}

export function needsMyAction(r, ctx) {
  const { user, D } = ctx;
  if (reqStatus(r) !== "pending") return false;
  const dealership = D(r.dealershipId);
  const isCorp = dealership.isCorporate;
  const bhPending = !r.bh.decision;
  const fnPending = !r.fn.decision;
  if (bhPending) {
    if (isCorp && user.role === "director") return true;
    if (!isCorp && user.role === "business_head" && user.dealershipIds.includes(r.dealershipId)) return true;
  }
  if (fnPending && user.role === "functional_head" && user.deptId === r.deptId) return true;
  /* Escalation: after LIMITS.slaDays of silence the Director may act in the approver's place */
  if (user.role === "director" && escalation(r)) return true;
  /* Director's purchase-stage approval, once both other signatures are in */
  if (user.role === "director" && needsDirectorPurchase(r) && !bhPending && !fnPending
      && r.directorPurchase?.decision !== "approved") return true;
  return false;
}
