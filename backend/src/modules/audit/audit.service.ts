import { HttpError } from "../../lib/http-error.js";
import type { AuthContext } from "../auth/auth.service.js";
import { orgRepository, type OrgRepository } from "../org/org.repository.js";
import { toAuditEntryDto, type AuditPageDto } from "./audit.dto.js";
import { auditRepository, type AuditRepository } from "./audit.repository.js";
import type { ListAuditQuery } from "./audit.schemas.js";

/* The Audit screen: the whole trail, a page at a time, for those allowed to see it (Director,
   functional heads). Activity for a single asset is served with the asset itself, scoped like the asset. */
export function createAuditService(repo: AuditRepository = auditRepository, orgRepo: Pick<OrgRepository, "findUserIdsByName"> = orgRepository) {
  return {
    async list(auth: AuthContext, query: ListAuditQuery): Promise<AuditPageDto> {
      if (!auth.permissions.canSeeAudit) throw HttpError.forbidden();
      const actorIds = query.q ? await orgRepo.findUserIdsByName(query.q) : undefined;
      const { rows, total } = await repo.page({
        refs: query.ref ? [query.ref] : undefined, q: query.q, actorIds,
        offset: (query.page - 1) * query.pageSize, limit: query.pageSize,
      });
      return { entries: rows.map(toAuditEntryDto), total, page: query.page, pageSize: query.pageSize };
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;
