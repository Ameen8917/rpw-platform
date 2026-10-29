import { Router, type RequestHandler } from "express";
import { validate } from "../../middleware/validate.js";
import { createAssetController } from "./assets.controller.js";
import { assetIdParams, createAssetBody, listAssetsQuery, lookupQuery } from "./assets.schemas.js";
import type { AssetService } from "./assets.service.js";

/* /api/assets — signed-in users; visibility and permissions are checked in the service */
export function assetRoutes(assets: AssetService, requireAuth: RequestHandler): Router {
  const c = createAssetController(assets);
  const router = Router();
  router.use(requireAuth);
  router.get("/", validate({ query: listAssetsQuery }), c.list);
  router.get("/lookup", validate({ query: lookupQuery }), c.lookup);
  router.get("/:id", validate({ params: assetIdParams }), c.get);
  router.post("/", validate({ body: createAssetBody }), c.create);
  return router;
}
