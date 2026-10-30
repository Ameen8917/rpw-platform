import type { RequestHandler } from "express";
import type { z } from "zod";
import { currentAuth } from "../auth/auth.middleware.js";
import type { accessoryBody, assetIdParams, createAssetBody, disposeBody, listAssetsQuery, lookupQuery, procuredBody } from "./assets.schemas.js";
import type { AssetService } from "./assets.service.js";

export function createAssetController(assets: AssetService) {
  const list: RequestHandler = async (_req, res) => {
    const query = res.locals.validated.query as z.infer<typeof listAssetsQuery>;
    res.json(await assets.list(currentAuth(res), query));
  };

  const get: RequestHandler = async (_req, res) => {
    const { id } = res.locals.validated.params as z.infer<typeof assetIdParams>;
    res.json(await assets.get(currentAuth(res), id));
  };

  const lookup: RequestHandler = async (_req, res) => {
    const { code } = res.locals.validated.query as z.infer<typeof lookupQuery>;
    res.json(await assets.lookup(currentAuth(res), code));
  };

  const create: RequestHandler = async (_req, res) => {
    const body = res.locals.validated.body as z.infer<typeof createAssetBody>;
    const asset = await assets.createExisting(currentAuth(res), body);
    res.status(201).location(`/api/assets/${asset.id}`).json(asset);
  };

  const createProcured: RequestHandler = async (_req, res) => {
    const body = res.locals.validated.body as z.infer<typeof procuredBody>;
    res.status(201).json(await assets.createProcured(currentAuth(res), body));
  };

  const addAccessory: RequestHandler = async (_req, res) => {
    const { id } = res.locals.validated.params as z.infer<typeof assetIdParams>;
    const body = res.locals.validated.body as z.infer<typeof accessoryBody>;
    res.status(201).json(await assets.addAccessory(currentAuth(res), id, body));
  };

  const dispose: RequestHandler = async (_req, res) => {
    const { id } = res.locals.validated.params as z.infer<typeof assetIdParams>;
    const body = res.locals.validated.body as z.infer<typeof disposeBody>;
    res.json(await assets.dispose(currentAuth(res), id, body));
  };

  return { list, get, lookup, create, createProcured, addAccessory, dispose };
}
