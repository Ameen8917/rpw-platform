import { HttpError } from "../../lib/http-error.js";
import type { AuthContext } from "../auth/auth.service.js";
import { toAuditEntryDto } from "./audit.dto.js";
import { auditRepository, type AuditRepository } from "./audit.repository.js";

/* The Audit screen: the whole trail, for those allowed to see it (Director, functional heads).
   Activity for a single asset is served with the asset itself, scoped like the asset. */
export function createAuditService(repo: AuditRepository = auditRepository) {
  return {
    async list(auth: AuthContext, opts: { ref?: string; limit: number }) {
      if (!auth.permissions.canSeeAudit) throw HttpError.forbidden();
      const rows = await repo.list({ refs: opts.ref ? [opts.ref] : undefined, limit: opts.limit });
      return rows.map(toAuditEntryDto);
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
