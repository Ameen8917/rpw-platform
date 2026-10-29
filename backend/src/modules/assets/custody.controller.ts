import type { RequestHandler } from "express";
import type { z } from "zod";
import { currentAuth } from "../auth/auth.middleware.js";
import type { assetIdParams } from "./assets.schemas.js";
import type { custodyQuery, issueBody, returnBody } from "./custody.schemas.js";
import type { CustodyService } from "./custody.service.js";

export function createCustodyController(custody: CustodyService) {
  const idOf = (locals: Record<string, unknown>) => (locals.validated as { params: z.infer<typeof assetIdParams> }).params.id;

  const issue: RequestHandler = async (_req, res) => {
    const body = res.locals.validated.body as z.infer<typeof issueBody>;
    res.json(await custody.issue(currentAuth(res), idOf(res.locals), body));
  };

  const accept: RequestHandler = async (_req, res) => {
    res.json(await custody.accept(currentAuth(res), idOf(res.locals)));
  };

  const recordReturn: RequestHandler = async (_req, res) => {
    const body = res.locals.validated.body as z.infer<typeof returnBody>;
    res.json(await custody.recordReturn(currentAuth(res), idOf(res.locals), body));
  };

  const register: RequestHandler = async (_req, res) => {
    const query = res.locals.validated.query as z.infer<typeof custodyQuery>;
    res.json(await custody.register(currentAuth(res), query));
  };

  return { issue, accept, recordReturn, register };
}
