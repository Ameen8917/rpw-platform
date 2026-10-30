import type { AuditEntryDto } from "../audit/audit.dto.js";
import { depreciation, todayIST, type AssetCategory, type AssetSource, type AssetStatus } from "./asset-rules.js";
import type { Asset, AssetAccessory, AssetDisposal, CustodyEvent, InvoiceDoc, ReturnCondition } from "./assets.models.js";

/* API shapes. They match Asset / Accessory in frontend/src/types/index.ts, except that
   purchaseDate is null (not "") when unknown, computed depreciation and the disposal record
   are included, and signature fields are short-lived URLs (in detail and lookup responses;
   null in lists). */

/** Signed URL per Storage path, for signature images */
export type SignedUrls = Map<string, string>;

export interface AccessoryDto {
  name: string;
  serial: string;
  origin: "bundled" | "separate";
  cost: number;
  addedAt: string;
  status: string;
}

export interface AcceptanceDto {
  method: "in_app" | "signature";
  at: string;
  /** Item names frozen at handover */
  snapshot: string[];
  signature: string | null;
  note?: string;
}

export interface ReturnRecordDto {
  at: string;
  receivedBy: string;
  from: string;
  signature: string | null;
  condition: ReturnCondition;
  missing: string[];
}

export interface DisposalDto {
  reason: string;
  scrapValue: number | null;
  /** Net book value on the day it was written off */
  bookValue: number | null;
  by: string;
  at: string;
}

export interface CustodyEventDto {
  id: string;
  kind: "issue" | "accept" | "return";
  at: string;
  holderId: string;
  actorId: string;
  method: "in_app" | "signature" | null;
  snapshot: string[];
  signature: string | null;
  note: string | null;
  condition: ReturnCondition | null;
  missing: string[];
}

export interface AssetDto {
  id: string;
  code: string;
  tagId: string;
  name: string;
  category: AssetCategory;
  make: string;
  model: string;
  serial: string;
  purchaseDate: string | null;
  cost: number;
  vendor: string;
  dealershipId: string;
  facilityId: string | null;
  deptId: string | null;
  warranty: string | null;
  status: AssetStatus;
  source: AssetSource;
  reqRef?: string;
  assignedTo: string | null;
  issuedBy?: string;
  issuedAt?: string;
  acceptance: AcceptanceDto | null;
  returnRecord: ReturnRecordDto | null;
  accessories: AccessoryDto[];
  verified?: boolean;
  invoiceDoc: InvoiceDoc | null;
  disposal: DisposalDto | null;
  /** As at today, or for a disposed asset as at its disposal date */
  depreciation: ReturnType<typeof depreciation>;
}

export interface AssetDetailDto extends AssetDto {
  /** Every issue, acceptance and return, newest first */
  custodyHistory: CustodyEventDto[];
  /** Audit entries for this asset's code and its requisition, newest first */
  activity: AuditEntryDto[];
}

/** Storage paths of the signatures an asset response shows */
export function signaturePaths(a: Asset): string[] {
  return [a.acceptanceEvent, a.returnEvent, ...(a.custodyHistory ?? [])]
    .map((e) => e?.signatureFile?.path)
    .filter((p): p is string => !!p);
}

const signatureUrl = (e: CustodyEvent, urls: SignedUrls) => (e.signatureFile ? urls.get(e.signatureFile.path) ?? null : null);

export function toAccessoryDto(x: AssetAccessory): AccessoryDto {
  return { name: x.name, serial: x.serial, origin: x.origin, cost: Number(x.cost), addedAt: x.addedAt, status: x.status };
}

/* A signed handover acknowledges itself; otherwise the holder's in-app acceptance does */
function toAcceptanceDto(a: Asset, urls: SignedUrls): AcceptanceDto | null {
  const e = a.acceptanceEvent;
  if (!e) return null;
  const note = (e.kind === "issue" ? e.note : a.custodyEvent?.note) ?? undefined;
  return {
    method: e.kind === "accept" ? "in_app" : "signature",
    at: e.at.toISOString(),
    snapshot: e.snapshot,
    signature: signatureUrl(e, urls),
    ...(note ? { note } : {}),
  };
}

function toReturnRecordDto(e: CustodyEvent | null | undefined, urls: SignedUrls): ReturnRecordDto | null {
  if (!e) return null;
  return {
    at: e.at.toISOString(), receivedBy: e.actorId, from: e.holderId,
    signature: signatureUrl(e, urls), condition: e.condition!, missing: e.missing,
  };
}

export function toCustodyEventDto(e: CustodyEvent, urls: SignedUrls): CustodyEventDto {
  return {
    id: e.id, kind: e.kind, at: e.at.toISOString(), holderId: e.holderId, actorId: e.actorId, method: e.method,
    snapshot: e.snapshot, signature: signatureUrl(e, urls), note: e.note, condition: e.condition, missing: e.missing,
  };
}

const toDisposalDto = (d: AssetDisposal | null | undefined): DisposalDto | null => d ? {
  reason: d.reason,
  scrapValue: d.scrapValue === null ? null : Number(d.scrapValue),
  bookValue: d.bookValue === null ? null : Number(d.bookValue),
  by: d.disposedBy,
  at: d.disposedAt.toISOString(),
} : null;

/** `asOf` is the "YYYY-MM-DD" date book values are calculated at */
export function toAssetDto(a: Asset, asOf: string, urls: SignedUrls = new Map()): AssetDto {
  const cost = Number(a.cost);
  return {
    id: a.id,
    code: a.code,
    tagId: String(a.tagId),
    name: a.name,
    category: a.category,
    make: a.make,
    model: a.model,
    serial: a.serial,
    purchaseDate: a.purchaseDate,
    cost,
    vendor: a.vendor,
    dealershipId: a.dealershipId,
    facilityId: a.facilityId,
    deptId: a.deptId,
    warranty: a.warranty,
    status: a.status,
    source: a.source,
    ...(a.reqRef ? { reqRef: a.reqRef } : {}),
    assignedTo: a.assignedTo,
    ...(a.issuedBy ? { issuedBy: a.issuedBy } : {}),
    ...(a.issuedAt ? { issuedAt: a.issuedAt.toISOString() } : {}),
    acceptance: toAcceptanceDto(a, urls),
    returnRecord: toReturnRecordDto(a.returnEvent, urls),
    accessories: [...(a.accessories ?? [])].sort((x, y) => x.position - y.position).map(toAccessoryDto),
    ...(a.verified === null ? {} : { verified: a.verified }),
    invoiceDoc: a.invoiceDoc,
    disposal: toDisposalDto(a.disposal),
    /* A written-off asset stops depreciating */
    depreciation: depreciation({ category: a.category, purchaseDate: a.purchaseDate, cost }, a.disposal ? todayIST(a.disposal.disposedAt) : asOf),
  };
}
