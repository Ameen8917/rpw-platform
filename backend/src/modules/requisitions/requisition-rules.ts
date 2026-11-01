import type { Limits } from "../settings/settings.schemas.js";
import type { RequisitionDto } from "./requisitions.dto.js";

/* Pure requisition and payment rules, ported from frontend/src/domain/requisitions.ts and
   payments.ts. Keep the two in step. The server enforces them; the frontend uses its copy to
   decide which buttons to show. */

export type ReqStatus = "pending" | "approved" | "rejected" | "procured";

/** Does this purchase need the Director before it can be bought? (not for Corporate, where the
    Director already signs as Business Head) */
export function needsDirectorPurchase(
  r: { estCost: number }, opts: { isCorporate: boolean; limits: Limits; approverLimits: (number | null)[] },
) {
  if (opts.isCorporate) return false;
  if (r.estCost > opts.limits.purchaseDirector) return true;
  return opts.approverLimits.some((l) => !!l && r.estCost > l);
}

export function reqStatus(r: RequisitionDto): ReqStatus {
  if (r.bh.decision === "rejected" || r.fn.decision === "rejected" || r.directorPurchase?.decision === "rejected") return "rejected";
  if (r.procurement) return "procured";
  if (r.bh.decision !== "approved" || r.fn.decision !== "approved") return "pending";
  if (r.directorPurchaseRequired && r.directorPurchase?.decision !== "approved") return "pending";
  return "approved";
}

const DAY = 86_400_000;
export const daysSince = (iso: string, now: Date) => Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);

/* Approver silence: who is holding this up, and for how long */
export function escalation(r: RequisitionDto, limits: Limits, now: Date): { stage: "bh" | "fn"; days: number } | null {
  if (reqStatus(r) !== "pending") return null;
  if (!r.bh.decision) {
    const d = daysSince(r.raisedAt, now);
    return d >= limits.slaDays ? { stage: "bh", days: d } : null;
  }
  if (!r.fn.decision) {
    const d = daysSince(r.bh.at!, now);
    return d >= limits.slaDays ? { stage: "fn", days: d } : null;
  }
  return null;
}

/* Actual cost over the estimate beyond tolerance */
export function variance(r: RequisitionDto, limits: Limits) {
  if (!r.procurement) return null;
  const over = r.procurement.actualCost - r.estCost;
  const pct = (over / r.estCost) * 100;
  return pct > limits.variancePct ? { over, pct } : null;
}

export const paidSoFar = (r: RequisitionDto) => (r.payments.advance?.amount ?? 0) + (r.payments.balance?.amount ?? 0);

export type PayStatus =
  | "not_ready" | "advance_approval" | "advance_finance" | "advance_director" | "advance_to_pay" | "advance_paid"
  | "awaiting_delivery" | "awaiting_verification" | "variance_reapproval" | "finance_signoff" | "director_signoff"
  | "balance_to_pay" | "settled" | "closed";

/* What Accounts must act on next */
export function payStatus(r: RequisitionDto, limits: Limits): PayStatus {
  const st = reqStatus(r);
  if (st === "rejected") return "closed";
  if (st === "pending") return "not_ready";
  const p = r.payments;
  /* Advance: Accounts Manager approves; above the escalation limit GM Finance and the Director
     also approve. The Accounts Executive then pays it. */
  if (r.advance.required && !p.advance) {
    if (r.advanceApproval?.decision !== "approved") return "advance_approval";
    if (r.advance.amount > limits.advanceEscalation) {
      if (r.advanceFinance?.decision !== "approved") return "advance_finance";
      if (r.advanceDirector?.decision !== "approved") return "advance_director";
    }
    return "advance_to_pay";
  }
  if (p.balance) return "settled";
  /* Final payment: verified entry, overrun re-approved, GM Finance sign-off, the Director at or
     above the threshold. Then the Accounts Executive pays the balance. */
  if (st === "procured") {
    if (r.procurement!.verification?.decision !== "verified") return "awaiting_verification";
    if (variance(r, limits) && r.varianceApproval?.decision !== "approved") return "variance_reapproval";
    if (r.financeApproval?.decision !== "approved") return "finance_signoff";
    if (r.procurement!.actualCost >= limits.directorPayment && r.directorApproval?.decision !== "approved") return "director_signoff";
    return "balance_to_pay";
  }
  return r.advance.required && p.advance ? "advance_paid" : "awaiting_delivery";
}

/** Balance still owed on the purchase */
export const balanceDue = (r: RequisitionDto) => (r.procurement ? r.procurement.actualCost - paidSoFar(r) : 0);
