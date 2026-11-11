import express, { Router, type RequestHandler } from "express";
import { validate } from "../../middleware/validate.js";
import { ATTACHMENT_MAX_BYTES } from "../files/files.service.js";
import { createAssetController } from "./assets.controller.js";
import { accessoryBody, assetIdParams, createAssetBody, disposeBody, listAssetsQuery, lookupQuery } from "./assets.schemas.js";
import type { AssetService } from "./assets.service.js";
import { createAttachmentController } from "./attachments.controller.js";
import { attachmentParams, attachmentQuery, removeAttachmentBody } from "./attachments.schemas.js";
import type { AttachmentService } from "./attachments.service.js";
import { createCustodyController } from "./custody.controller.js";
import { acceptBody, custodyQuery, issueBody, returnBody } from "./custody.schemas.js";
import type { CustodyService } from "./custody.service.js";

/* /api/assets — signed-in users; visibility and permissions are checked in the services */
export function assetRoutes(assets: AssetService, custody: CustodyService, attachments: AttachmentService, requireAuth: RequestHandler): Router {
  const c = createAssetController(assets);
  const cu = createCustodyController(custody);
  const at = createAttachmentController(attachments);
  const router = Router();
  router.use(requireAuth);
  router.get("/", validate({ query: listAssetsQuery }), c.list);
  router.get("/lookup", validate({ query: lookupQuery }), c.lookup);
  router.get("/:id", validate({ params: assetIdParams }), c.get);
  router.post("/", validate({ body: createAssetBody }), c.create);
  router.post("/:id/accessories", validate({ params: assetIdParams, body: accessoryBody }), c.addAccessory);
  router.post("/:id/dispose", validate({ params: assetIdParams, body: disposeBody }), c.dispose);
  router.post("/:id/issue", validate({ params: assetIdParams, body: issueBody }), cu.issue);
  router.post("/:id/accept", validate({ params: assetIdParams, body: acceptBody }), cu.accept);
  router.post("/:id/return", validate({ params: assetIdParams, body: returnBody }), cu.recordReturn);
  /* The file is the raw body (Content-Type: its type), as for invoice reading; the query is
     checked before the body is read */
  router.post("/:id/attachments", validate({ params: assetIdParams, query: attachmentQuery }),
    express.raw({ type: () => true, limit: ATTACHMENT_MAX_BYTES }), at.add);
  router.post("/:id/attachments/:attachmentId/remove", validate({ params: attachmentParams, body: removeAttachmentBody }), at.remove);
  return router;
}

/* GET /api/custody — custody register (Director, functional heads, Business Heads) */
export function custodyRoutes(custody: CustodyService, requireAuth: RequestHandler): Router {
  const cu = createCustodyController(custody);
  const router = Router();
  router.use(requireAuth);
  router.get("/", validate({ query: custodyQuery }), cu.register);
  return router;
}
