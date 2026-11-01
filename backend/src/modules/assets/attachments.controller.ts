import type { RequestHandler } from "express";
import type { z } from "zod";
import { currentAuth } from "../auth/auth.middleware.js";
import type { assetIdParams } from "./assets.schemas.js";
import type { attachmentParams, attachmentQuery } from "./attachments.schemas.js";
import type { AttachmentService } from "./attachments.service.js";

export function createAttachmentController(attachments: AttachmentService) {
  /* The body is the file (express.raw); the service checks its bytes */
  const add: RequestHandler = async (req, res) => {
    const { id } = res.locals.validated.params as z.infer<typeof assetIdParams>;
    const query = res.locals.validated.query as z.infer<typeof attachmentQuery>;
    res.status(201).json(await attachments.add(currentAuth(res), id, query, req.body));
  };

  const remove: RequestHandler = async (_req, res) => {
    const { id, attachmentId } = res.locals.validated.params as z.infer<typeof attachmentParams>;
    res.json(await attachments.remove(currentAuth(res), id, attachmentId));
  };

  return { add, remove };
}
