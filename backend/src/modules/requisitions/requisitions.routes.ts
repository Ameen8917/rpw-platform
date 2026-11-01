import { Router, type RequestHandler } from "express";
import { validate } from "../../middleware/validate.js";
import { createRequisitionController } from "./requisitions.controller.js";
import {
  decisionBody, decisionParams, paymentBody, paymentParams, procureBody, raiseBody, requisitionIdParams, resubmitBody, verifyBody,
} from "./requisitions.schemas.js";
import type { RequisitionService } from "./requisitions.service.js";

/* /api/requisitions — signed-in users; each action checks who may take it (docs/requisitions.md) */
export function requisitionRoutes(reqs: RequisitionService, requireAuth: RequestHandler): Router {
  const c = createRequisitionController(reqs);
  const router = Router();
  router.use(requireAuth);
  router.get("/", c.list);
  router.post("/", validate({ body: raiseBody }), c.raise);
  router.get("/:id", validate({ params: requisitionIdParams }), c.get);
  router.post("/:id/decisions/:stage", validate({ params: decisionParams, body: decisionBody }), c.decide);
  router.post("/:id/resubmit", validate({ params: requisitionIdParams, body: resubmitBody }), c.resubmit);
  router.post("/:id/procure", validate({ params: requisitionIdParams, body: procureBody }), c.procure);
  router.post("/:id/verify", validate({ params: requisitionIdParams, body: verifyBody }), c.verify);
  router.post("/:id/payments/:kind", validate({ params: paymentParams, body: paymentBody }), c.pay);
  return router;
}
