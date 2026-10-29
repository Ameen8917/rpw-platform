/* Domain model for the RPW platform.
   Derived from the prototype's seed data and the fields its workflows write.
   The backend's database schema and Zod contracts should match these shapes. */

export type ID = string;
/** ISO date ("2026-09-06") or timestamp ("2026-09-06T10:20:00") */
export type ISODate = string;

/* ------------------------------- Org -------------------------------------- */
export interface Dealership {
  id: ID;
  short: string;            // 3-letter code used in asset codes: RPW/<short>/...
  name: string;
  brand: string;
  code: string;             // OEM dealer code
  headId: ID | null;        // Business Head
  territory: string[];
  active: boolean;
  isCorporate?: boolean;
  note?: string;
}

export type FacilityType = "3S facility" | "Sales outlet" | "Service outlet" | "Parts outlet" | "Corporate office";

export interface Facility {
  id: ID;
  dealershipId: ID;
  name: string;
  type: FacilityType;
  district: string;
  active: boolean;
}

export interface Department {
  id: ID;
  name: string;
  /** Business Head + corporate functional head must both approve */
  dualAuthority: boolean;
  functionalHeadId: ID | null;
  active: boolean;
}

export type Role = "director" | "functional_head" | "business_head" | "manager" | "accounts_executive" | "staff";

export interface User {
  id: ID;
  facilityId: ID | null;
  empCode: string;
  name: string;
  role: Role;
  title: string;
  dealershipIds: ID[];
  deptId: ID | null;
  /** Frontline staff: can hold assets, cannot log in */
  noLogin?: boolean;
  inactive?: boolean;
  approvalLimit?: number | null;
}

/* ------------------------------ Assets ------------------------------------ */
export type AssetCategory =
  | "IT Equipment" | "IT – Servers & Network" | "Diagnostic Equipment" | "Workshop Equipment"
  | "Machinery & Power" | "Furniture & Fixtures" | "Office Equipment" | "Internal Vehicles";

export type AssetStatus = "in_use" | "in_storage" | "under_repair" | "disposed";
export type AssetSource = "existing" | "procured";

export interface Accessory {
  name: string;
  serial: string;
  origin: "bundled" | "separate";
  cost: number;
  addedAt: ISODate;
  status: "with_asset" | string;
}

export interface Acceptance {
  method: "in_app" | "signature";
  at: ISODate;
  /** Item names frozen at handover */
  snapshot: string[];
  signature?: string | null;   // PNG data URL
  note?: string;
}

export interface ReturnRecord {
  at: ISODate;
  receivedBy: ID;
  from: ID | null;
  signature: string | null;
  condition: string;
  missing: string[];
}

export interface InvoiceDoc {
  fileName?: string;
  fileUrl?: string;
  fileType?: string;
  vendor?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  total?: number;
}

export interface Asset {
  id: ID;
  code: string;               // RPW/JNS/IT/26-27/0007
  tagId: string;              // short numeric tag for small labels
  name: string;
  category: AssetCategory;
  make: string;
  model: string;
  serial: string;
  purchaseDate: ISODate;
  cost: number;
  vendor: string;
  dealershipId: ID;
  facilityId: ID | null;
  deptId: ID | null;
  warranty: ISODate | null;
  status: AssetStatus;
  source: AssetSource;
  reqRef?: string;
  assignedTo: ID | null;
  issuedBy?: ID;
  issuedAt?: ISODate;
  acceptance?: Acceptance | null;
  returnRecord?: ReturnRecord | null;
  accessories?: Accessory[];
  verified?: boolean;
  invoiceDoc?: InvoiceDoc | null;
}

/* --------------------------- Requisitions --------------------------------- */
export type Decision = "approved" | "rejected" | null;

export interface ApprovalSlot {
  decision: Decision;
  by?: ID | null;
  at?: ISODate | null;
  note?: string;
  /** Director acted in place of a silent approver */
  onBehalfOf?: ID;
  lateDays?: number;
}

export interface Payment {
  by: ID;
  at: ISODate;
  amount: number;
  mode: string;
  ref: string;               // UTR / cheque number
}

export interface Procurement {
  by: ID;
  at: ISODate;
  actualCost: number;
  vendor: string;
  invoice: string;
  assetCodes: string[];
  invoiceDoc?: InvoiceDoc | null;
  verification?: { decision: "verified" | string; by: ID; at: ISODate; note: string } | null;
}

export interface Requisition {
  id: ID;
  ref: string;               // REQ-2026-0027
  dealershipId: ID;
  facilityId: ID;
  deptId: ID;
  item: string;
  qty: number;
  estCost: number;
  justification: string;
  raisedBy: ID;
  raisedAt: ISODate;
  advance: { required: boolean; amount: number; terms: string };
  expectedDelivery?: ISODate;
  bh: ApprovalSlot;
  fn: ApprovalSlot;
  directorPurchase?: ApprovalSlot;
  advanceApproval?: ApprovalSlot;
  advanceFinance?: ApprovalSlot;
  advanceDirector?: ApprovalSlot;
  varianceApproval?: ApprovalSlot;
  financeApproval?: ApprovalSlot;
  directorApproval?: ApprovalSlot;
  payments: { advance: Payment | null; balance: Payment | null };
  procurement: Procurement | null;
  revisionOf?: string;
  resubmittedAs?: string;
  sentBack?: { by: ID; at: ISODate; note: string };
}

/* ------------------------------- Audit ------------------------------------ */
export interface AuditEntry {
  id: ID;
  at: ISODate;
  actorId: ID;
  action: string;
  ref: string;
  detail: string;
}
