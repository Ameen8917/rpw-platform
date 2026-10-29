import { LIMITS } from "./config";
import { reqStatus, variance } from "./requisitions";
import { TODAY } from "../lib/format";
import { T } from "../theme";
import type { Requisition, User } from "../types";
import type { Permissions } from "./permissions";

/* Derived payment status — what Accounts must act on */
export const PAY_STATUS = {
  not_ready: { label: "Not approved yet", c: T.sub, bg: T.slateBg },
  advance_approval: { label: "Advance — awaiting Accounts Manager", c: T.bad, bg: T.badBg },
  advance_finance: { label: "Advance — awaiting GM Finance", c: T.accent, bg: T.warnBg },
  advance_director: { label: "Advance — awaiting Director", c: T.primary, bg: T.primarySoft },
  advance_to_pay: { label: "Advance approved — to pay", c: T.accent, bg: T.warnBg },
  advance_paid: { label: "Advance paid — awaiting delivery", c: T.warn, bg: T.warnBg },
  awaiting_delivery: { label: "Approved — awaiting delivery", c: T.primary, bg: T.primarySoft },
  awaiting_verification: { label: "Asset entry to verify", c: T.accent, bg: T.warnBg },
  variance_reapproval: { label: "Cost overrun — Director re-approval", c: T.bad, bg: T.badBg },
  finance_signoff: { label: "Awaiting payment sign-off", c: T.accent, bg: T.warnBg },
  director_signoff: { label: "Awaiting Director approval", c: T.primary, bg: T.primarySoft },
  balance_to_pay: { label: "Approved — to pay", c: T.accent, bg: T.warnBg },
  settled: { label: "Fully settled", c: T.ok, bg: T.okBg },
  closed: { label: "Closed — no payment", c: T.sub, bg: T.slateBg },
};

export const TO_PAY = ["advance_to_pay", "balance_to_pay"];

export type PayStatus = keyof typeof PAY_STATUS;
export function payStatus(r: Requisition): PayStatus {
  const st = reqStatus(r);
  if (st === "rejected") return "closed";
  if (st === "pending") return "not_ready";
  const p = r.payments || { advance: null, balance: null };
  /* Advance: Accounts Manager approves; above the escalation limit GM Finance and
     Director must also approve. Accounts Executive then executes. */
  if (r.advance?.required && !p.advance) {
    if (r.advanceApproval?.decision !== "approved") return "advance_approval";
    if (r.advance.amount > LIMITS.advanceEscalation) {
      if (r.advanceFinance?.decision !== "approved") return "advance_finance";
      if (r.advanceDirector?.decision !== "approved") return "advance_director";
    }
    return "advance_to_pay";
  }
  if (p.balance) return "settled";
  /* Final payment: GM Finance signs off; Director approves only at or above the
     threshold. Accounts Executive then executes. */
  if (st === "procured") {
    /* Entered by a dealership manager? The functional head verifies before money moves. */
    if (r.procurement.verification?.decision !== "verified") return "awaiting_verification";
    if (variance(r) && r.varianceApproval?.decision !== "approved") return "variance_reapproval";
    if (r.financeApproval?.decision !== "approved") return "finance_signoff";
    if (r.procurement.actualCost >= LIMITS.directorPayment && r.directorApproval?.decision !== "approved") return "director_signoff";
    return "balance_to_pay";
  }
  /* Approved, nothing procured yet. Either the advance is done, or none was ever needed. */
  return r.advance?.required && p.advance ? "advance_paid" : "awaiting_delivery";
}

/* Advance paid but goods not yet received past the expected date */
export function advanceOutstanding(r: Requisition) {
  const p = r.payments || { advance: null, balance: null };
  if (!p.advance || r.procurement) return null;
  if (!r.expectedDelivery) return null;
  const days = Math.floor((TODAY.getTime() - new Date(r.expectedDelivery).getTime()) / 86400000);
  return days > 0 ? { days, amount: p.advance.amount } : null;
}

/* Does this requisition need action from this user right now? */
export function needsPaymentAction(r: Requisition, user: User, perm: Permissions) {
  const p = payStatus(r);
  const mine = user.dealershipIds?.includes(r.dealershipId);
  if (p === "advance_approval") return perm.canApproveAdvance && mine;
  if (p === "awaiting_verification") return perm.canVerifyEntry && user.deptId === r.deptId;
  if (p === "advance_finance" || p === "finance_signoff") return perm.canFinanceSignoff;
  if (p === "advance_director" || p === "director_signoff" || p === "variance_reapproval") return perm.isDirector;
  if (TO_PAY.includes(p)) return perm.canExecutePayment && mine;
  return false;
}

export function dueAmount(r: Requisition) {
  const p = payStatus(r);
  if (["advance_approval", "advance_finance", "advance_director", "advance_to_pay"].includes(p)) return r.advance.amount;
  if (["finance_signoff", "director_signoff", "balance_to_pay", "variance_reapproval", "awaiting_verification"].includes(p)) return r.procurement.actualCost - paidSoFar(r);
  return 0;
}

export function paidSoFar(r: Requisition) {
  const p = r.payments || { advance: null, balance: null };
  return (p.advance?.amount || 0) + (p.balance?.amount || 0);
}
