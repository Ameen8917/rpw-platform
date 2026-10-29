import type { AuditEntryDto } from "../audit/audit.dto.js";
import { depreciation, type AssetCategory, type AssetSource, type AssetStatus } from "./asset-rules.js";
import type { Asset, AssetAccessory, InvoiceDoc } from "./assets.models.js";

/* API shapes. They match Asset / Accessory in frontend/src/types/index.ts, except that
   purchaseDate is null (not "") when unknown, and computed depreciation is included.
   Custody acknowledgement and return records arrive with M4. */

export interface AccessoryDto {
  name: string;
  serial: string;
  origin: "bundled" | "separate";
  cost: number;
  addedAt: string;
  status: string;
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
  acceptance: null;
  returnRecord: null;
  accessories: AccessoryDto[];
  verified?: boolean;
  invoiceDoc: InvoiceDoc | null;
  depreciation: ReturnType<typeof depreciation>;
}

export interface AssetDetailDto extends AssetDto {
  /** Audit entries for this asset's code and its requisition, newest first */
  activity: AuditEntryDto[];
}

export function toAccessoryDto(x: AssetAccessory): AccessoryDto {
  return { name: x.name, serial: x.serial, origin: x.origin, cost: Number(x.cost), addedAt: x.addedAt, status: x.status };
}

/** `asOf` is the "YYYY-MM-DD" date book values are calculated at */
export function toAssetDto(a: Asset, asOf: string): AssetDto {
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
    acceptance: null,
    returnRecord: null,
    accessories: [...(a.accessories ?? [])].sort((x, y) => x.position - y.position).map(toAccessoryDto),
    ...(a.verified === null ? {} : { verified: a.verified }),
    invoiceDoc: a.invoiceDoc,
    depreciation: depreciation({ category: a.category, purchaseDate: a.purchaseDate, cost }, asOf),
  };
}
