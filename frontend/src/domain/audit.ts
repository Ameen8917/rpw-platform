import type { AuditEntry } from "../types";

export function aud(at: string, actorId: string, action: string, ref: string, detail: string): AuditEntry {
  return { id: Math.random().toString(36).slice(2), at, actorId, action, ref, detail };
}
