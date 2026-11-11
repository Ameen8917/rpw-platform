import type { InvoiceDoc } from "../assets/assets.models.js";
import type { Decision, Requisition, Stage } from "./requisitions.models.js";

/* Matches Requisition in frontend/src/types/index.ts, so the screens and their derived rules
   (reqStatus, payStatus, escalation) work on it unchanged */

export interface ApprovalSlotDto {
  decision: Decision | null;
  by: string | null;
  at: string | null;
  note: string;
  onBehalfOf?: string;
  lateDays?: number;
}

export interface PaymentDto {
  by: string;
  at: string;
  amount: number;
  mode: string;
  ref: string;
}

export interface ProcurementDto {
  by: string;
  at: string;
  actualCost: number;
  vendor: string;
  invoice: string;
  assetCodes: string[];
  invoiceDoc: InvoiceDoc | null;
  verification: { decision: "verified"; by: string; at: string; note: string } | null;
}

export interface RequisitionDto {
  id: string;
  ref: string;
  dealershipId: string;
  facilityId: string | null;
  deptId: string;
  item: string;
  qty: number;
  estCost: number;
  justification: string;
  raisedBy: string;
  raisedAt: string;
  advance: { required: boolean; amount: number; terms: string };
  expectedDelivery?: string;
  bh: ApprovalSlotDto;
  fn: ApprovalSlotDto;
  directorPurchase?: ApprovalSlotDto;
  advanceApproval?: ApprovalSlotDto;
  advanceFinance?: ApprovalSlotDto;
  advanceDirector?: ApprovalSlotDto;
  varianceApproval?: ApprovalSlotDto;
  financeApproval?: ApprovalSlotDto;
  directorApproval?: ApprovalSlotDto;
  payments: { advance: PaymentDto | null; balance: PaymentDto | null };
  procurement: ProcurementDto | null;
  revisionOf?: string;
  resubmittedAs?: string;
  sentBack?: { by: string; at: string; note: string };
  /** Estimate above the group limit, or above an approver's personal limit (not for Corporate) */
  directorPurchaseRequired: boolean;
}

/** The purchase recorded for a requisition (an asset_procurements row and the codes it created) */
export interface PurchaseRecord {
  recordedBy: string;
  recordedAt: Date;
  total: number;
  vendor: string;
  invoiceNo: string;
  invoiceDoc: InvoiceDoc | null;
  verified: boolean;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  verificationNote: string | null;
  assetCodes: string[];
}

const EMPTY_SLOT = (): ApprovalSlotDto => ({ decision: null, by: null, at: null, note: "" });

export function toRequisitionDto(r: Requisition, purchase: PurchaseRecord | null, directorPurchaseRequired: boolean): RequisitionDto {
  const slots: Partial<Record<Stage, ApprovalSlotDto>> = {};
  for (const a of r.approvals ?? []) {
    slots[a.stage] = {
      decision: a.decision, by: a.decidedBy, at: a.decidedAt.toISOString(), note: a.note,
      ...(a.onBehalfOf ? { onBehalfOf: a.onBehalfOf } : {}),
      ...(a.lateDays !== null ? { lateDays: a.lateDays } : {}),
    };
  }
  const pay = (kind: "advance" | "balance"): PaymentDto | null => {
    const p = (r.payments ?? []).find((x) => x.kind === kind);
    return p ? { by: p.paidBy, at: p.paidAt.toISOString(), amount: Number(p.amount), mode: p.mode, ref: p.ref } : null;
  };
  const { bh, fn, ...rest } = slots;
  return {
    id: r.id, ref: r.ref, dealershipId: r.dealershipId, facilityId: r.facilityId, deptId: r.deptId,
    item: r.item, qty: r.qty, estCost: Number(r.estCost), justification: r.justification,
    raisedBy: r.raisedBy, raisedAt: r.raisedAt.toISOString(),
    advance: { required: r.advanceRequired, amount: Number(r.advanceAmount), terms: r.advanceTerms },
    ...(r.expectedDelivery ? { expectedDelivery: r.expectedDelivery } : {}),
    bh: bh ?? EMPTY_SLOT(),
    fn: fn ?? EMPTY_SLOT(),
    ...rest,
    payments: { advance: pay("advance"), balance: pay("balance") },
    procurement: purchase && {
      by: purchase.recordedBy, at: purchase.recordedAt.toISOString(), actualCost: purchase.total,
      vendor: purchase.vendor, invoice: purchase.invoiceNo, assetCodes: purchase.assetCodes, invoiceDoc: purchase.invoiceDoc,
      verification: purchase.verified ? {
        decision: "verified",
        by: purchase.verifiedBy ?? purchase.recordedBy,
        at: (purchase.verifiedAt ?? purchase.recordedAt).toISOString(),
        note: purchase.verificationNote ?? "",
      } : null,
    },
    ...(r.revisionOf ? { revisionOf: r.revisionOf } : {}),
    ...(r.resubmittedAs ? { resubmittedAs: r.resubmittedAs } : {}),
    ...(r.sentBackBy && r.sentBackAt ? { sentBack: { by: r.sentBackBy, at: r.sentBackAt.toISOString(), note: r.sentBackNote ?? "" } } : {}),
    directorPurchaseRequired,
  };
}
