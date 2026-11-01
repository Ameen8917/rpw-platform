import type { AuditEntry } from "./audit.models.js";

/* Matches AuditEntry in frontend/src/types/index.ts */
export interface AuditEntryDto {
  id: string;
  at: string;
  actorId: string;
  action: string;
  ref: string;
  detail: string;
}

/** GET /api/audit: one page of entries, newest first, and how many match in all */
export interface AuditPageDto {
  entries: AuditEntryDto[];
  total: number;
  page: number;
  pageSize: number;
}

export function toAuditEntryDto(e: AuditEntry): AuditEntryDto {
  return { id: e.id, at: e.at.toISOString(), actorId: e.actorId, action: e.action, ref: e.ref, detail: e.detail };
}
