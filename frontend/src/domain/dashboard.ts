/* Pure aggregations behind the dashboard charts. Inputs are the requisitions and assets
   the viewer can already see, so every figure respects their scope. */
import type { Asset, Requisition } from "../types";
import { custodyState } from "./assets";
import { dueAmount, paidSoFar, payStatus, type PayStatus } from "./payments";
import { escalation, needsDirectorPurchase, reqStatus } from "./requisitions";

/* ----------------------------- Operations now ----------------------------- */

export type ApprovalStage = "bh" | "fn" | "director";
export const APPROVAL_STAGES: { key: ApprovalStage; label: string }[] = [
  { key: "bh", label: "Business Head" },
  { key: "fn", label: "Functional head" },
  { key: "director", label: "Director" },
];

/** Whose signature a pending requisition is waiting for */
export function approvalStage(r: Requisition): ApprovalStage | null {
  if (reqStatus(r) !== "pending") return null;
  if (!r.bh.decision) return "bh";
  if (!r.fn.decision) return "fn";
  return needsDirectorPurchase(r) && !r.directorPurchase?.decision ? "director" : null;
}

/** Pending approvals per stage, split into within the SLA and overdue */
export function approvalsByStage(reqs: Requisition[], now?: Date) {
  return APPROVAL_STAGES.map(({ key, label }) => {
    const here = reqs.filter((r) => approvalStage(r) === key);
    const overdue = here.filter((r) => escalation(r, now)).length;
    return { key, label, onTime: here.length - overdue, overdue };
  });
}

/* Payment states grouped into the three places money can be held up */
const PHASES: { key: string; label: string; states: PayStatus[]; amount: (r: Requisition) => number }[] = [
  { key: "approval", label: "Awaiting approval or sign-off",
    states: ["advance_approval", "advance_finance", "advance_director", "awaiting_verification", "variance_reapproval", "finance_signoff", "director_signoff"],
    amount: dueAmount },
  { key: "to_pay", label: "Approved, ready to transfer", states: ["advance_to_pay", "balance_to_pay"], amount: dueAmount },
  { key: "advance_out", label: "Advance paid, awaiting delivery", states: ["advance_paid"], amount: paidSoFar },
];

export function paymentPhases(reqs: Requisition[]) {
  return PHASES.map(({ key, label, states, amount }) => {
    const here = reqs.filter((r) => states.includes(payStatus(r)));
    return { key, label, amount: here.reduce((s, r) => s + amount(r), 0), count: here.length };
  });
}

/** Live assets by where custody stands. Repair wins over custody, since the asset is out of use. */
export const CUSTODY_GROUPS = [
  { key: "acknowledged", label: "Issued and acknowledged" },
  { key: "awaiting", label: "Issued, awaiting acknowledgement" },
  { key: "storage", label: "Not issued (in storage)" },
  { key: "repair", label: "Under repair" },
] as const;
export type CustodyGroup = (typeof CUSTODY_GROUPS)[number]["key"];

export function custodyGroup(a: Asset): CustodyGroup | null {
  if (a.status === "disposed") return null;
  if (a.status === "under_repair") return "repair";
  const c = custodyState(a);
  return c === "unissued" ? "storage" : c === "pending" ? "awaiting" : "acknowledged";
}

export function custodyBreakdown(assets: Asset[]) {
  return CUSTODY_GROUPS.map((g) => ({ ...g, count: assets.filter((a) => custodyGroup(a) === g.key).length }));
}

/* --------------------------------- Spending -------------------------------- */

/** "2026-08" -> the n month keys ending there, oldest first */
export function monthWindow(endMonth: string, n: number): string[] {
  const [y, m] = endMonth.split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-08" -> "Aug 2026" (long) or "Aug" (short) */
export function monthLabel(key: string, long = false) {
  const [y, m] = key.split("-");
  const name = MONTHS[Number(m) - 1];
  return long ? `${name} ${y}` : name;
}

export interface Purchase { id: string; month: string; cost: number; dealershipId: string }

/** Completed purchases: requisitions with a recorded procurement */
export function purchasesOf(reqs: { id: string; dealershipId: string; procurement?: { at: string; actualCost: number } | null }[]): Purchase[] {
  return reqs.filter((r) => r.procurement).map((r) => ({
    id: r.id, month: r.procurement.at.slice(0, 7), cost: Number(r.procurement.actualCost) || 0, dealershipId: r.dealershipId,
  }));
}

/** Spend and count per month across the window (months with nothing are zero, not missing) */
export function spendByMonth(purchases: Purchase[], months: string[]) {
  return months.map((month) => {
    const inMonth = purchases.filter((p) => p.month === month);
    return { month, spend: inMonth.reduce((s, p) => s + p.cost, 0), count: inMonth.length };
  });
}

/** Totals per key, largest first; anything past `top` folds into one "Other" row */
export function rankBy<K extends string>(items: { key: K; value: number }[], top = 6) {
  const totals = new Map<K, number>();
  for (const it of items) totals.set(it.key, (totals.get(it.key) || 0) + it.value);
  const rows = [...totals].map(([key, value]) => ({ key, value })).filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value || String(a.key).localeCompare(String(b.key)));
  if (rows.length <= top) return rows;
  const rest = rows.slice(top - 1);
  return [...rows.slice(0, top - 1), { key: "__other" as K, value: rest.reduce((s, r) => s + r.value, 0), others: rest.length }];
}

/** Round axis ticks from 0 that cover `max`: steps of 1, 2, 2.5 or 5 x 10^k */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((s) => s >= raw) as number;
  const ticks = [];
  for (let v = 0; v < max + step * 0.999; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}
