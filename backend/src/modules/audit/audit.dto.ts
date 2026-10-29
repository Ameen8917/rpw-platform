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

export function toAuditEntryDto(e: AuditEntry): AuditEntryDto {
  return { id: e.id, at: e.at.toISOString(), actorId: e.actorId, action: e.action, ref: e.ref, detail: e.detail };
}
