import { Router, type RequestHandler } from "express";
import { validate } from "../../middleware/validate.js";
import { createAssetController } from "./assets.controller.js";
import { accessoryBody, assetIdParams, createAssetBody, disposeBody, listAssetsQuery, lookupQuery, procuredBody } from "./assets.schemas.js";
import type { AssetService } from "./assets.service.js";
import { createCustodyController } from "./custody.controller.js";
import { acceptBody, custodyQuery, issueBody, returnBody } from "./custody.schemas.js";
import type { CustodyService } from "./custody.service.js";

/* /api/assets — signed-in users; visibility and permissions are checked in the services */
export function assetRoutes(assets: AssetService, custody: CustodyService, requireAuth: RequestHandler): Router {
  const c = createAssetController(assets);
  const cu = createCustodyController(custody);
  const router = Router();
  router.use(requireAuth);
  router.get("/", validate({ query: listAssetsQuery }), c.list);
  router.get("/lookup", validate({ query: lookupQuery }), c.lookup);
  router.get("/:id", validate({ params: assetIdParams }), c.get);
  router.post("/", validate({ body: createAssetBody }), c.create);
  router.post("/procured", validate({ body: procuredBody }), c.createProcured);
  router.post("/:id/accessories", validate({ params: assetIdParams, body: accessoryBody }), c.addAccessory);
  router.post("/:id/dispose", validate({ params: assetIdParams, body: disposeBody }), c.dispose);
  router.post("/:id/issue", validate({ params: assetIdParams, body: issueBody }), cu.issue);
  router.post("/:id/accept", validate({ params: assetIdParams, body: acceptBody }), cu.accept);
  router.post("/:id/return", validate({ params: assetIdParams, body: returnBody }), cu.recordReturn);
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
