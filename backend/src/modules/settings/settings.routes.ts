import { Router, type RequestHandler } from "express";
import { validate } from "../../middleware/validate.js";
import { createSettingsController } from "./settings.controller.js";
import { settingsBody } from "./settings.schemas.js";
import type { SettingsService } from "./settings.service.js";

/* GET /api/settings — anyone signed in (the screens need the limits); PUT — Admin console */
export function settingsRoutes(settings: SettingsService, requireAuth: RequestHandler): Router {
  const c = createSettingsController(settings);
  const router = Router();
  router.use(requireAuth);
  router.get("/", c.get);
  router.put("/", validate({ body: settingsBody }), c.update);
  return router;
}
