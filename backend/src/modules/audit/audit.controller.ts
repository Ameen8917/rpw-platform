import type { RequestHandler } from "express";
import type { z } from "zod";
import { currentAuth } from "../auth/auth.middleware.js";
import type { listAuditQuery } from "./audit.schemas.js";
import type { AuditService } from "./audit.service.js";

export function createAuditController(audit: AuditService) {
  const list: RequestHandler = async (_req, res) => {
    const query = res.locals.validated.query as z.infer<typeof listAuditQuery>;
    res.json(await audit.list(currentAuth(res), query));
  };
  return { list };
}
