import type { RequestHandler } from "express";
import type { z } from "zod";
import { currentAuth } from "../auth/auth.middleware.js";
import type {
  decisionBody, decisionParams, paymentBody, paymentParams, procureBody, raiseBody, requisitionIdParams, resubmitBody, verifyBody,
} from "./requisitions.schemas.js";
import type { RequisitionService } from "./requisitions.service.js";

export function createRequisitionController(reqs: RequisitionService) {
  const params = (res: Parameters<RequestHandler>[1]) => res.locals.validated.params as z.infer<typeof requisitionIdParams>;

  const list: RequestHandler = async (_req, res) => { res.json(await reqs.list(currentAuth(res))); };

  const get: RequestHandler = async (_req, res) => { res.json(await reqs.get(currentAuth(res), params(res).id)); };

  const raise: RequestHandler = async (_req, res) => {
    const created = await reqs.raise(currentAuth(res), res.locals.validated.body as z.infer<typeof raiseBody>);
    res.status(201).location(`/api/requisitions/${created.id}`).json(created);
  };

  const decide: RequestHandler = async (_req, res) => {
    const { id, stage } = res.locals.validated.params as z.infer<typeof decisionParams>;
    res.json(await reqs.decide(currentAuth(res), id, stage, res.locals.validated.body as z.infer<typeof decisionBody>));
  };

  const resubmit: RequestHandler = async (_req, res) => {
    const created = await reqs.resubmit(currentAuth(res), params(res).id, res.locals.validated.body as z.infer<typeof resubmitBody>);
    res.status(201).location(`/api/requisitions/${created.id}`).json(created);
  };

  const procure: RequestHandler = async (_req, res) => {
    res.status(201).json(await reqs.procure(currentAuth(res), params(res).id, res.locals.validated.body as z.infer<typeof procureBody>));
  };

  const verify: RequestHandler = async (_req, res) => {
    res.json(await reqs.verify(currentAuth(res), params(res).id, res.locals.validated.body as z.infer<typeof verifyBody>));
  };

  const pay: RequestHandler = async (_req, res) => {
    const { id, kind } = res.locals.validated.params as z.infer<typeof paymentParams>;
    res.status(201).json(await reqs.pay(currentAuth(res), id, kind, res.locals.validated.body as z.infer<typeof paymentBody>));
  };

  return { list, get, raise, decide, resubmit, procure, verify, pay };
}
