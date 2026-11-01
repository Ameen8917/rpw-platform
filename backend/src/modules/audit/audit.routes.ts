import { Router, type RequestHandler } from "express";
import { validate } from "../../middleware/validate.js";
import { createAuditController } from "./audit.controller.js";
import { listAuditQuery } from "./audit.schemas.js";
import type { AuditService } from "./audit.service.js";

/* GET /api/audit?ref=&q=&page=&pageSize= — Director and functional heads */
export function auditRoutes(audit: AuditService, requireAuth: RequestHandler): Router {
  const c = createAuditController(audit);
  const router = Router();
  router.use(requireAuth);
  router.get("/", validate({ query: listAuditQuery }), c.list);
  return router;
}
