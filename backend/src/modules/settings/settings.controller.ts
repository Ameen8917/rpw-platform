import type { RequestHandler } from "express";
import type { z } from "zod";
import { currentAuth } from "../auth/auth.middleware.js";
import type { settingsBody } from "./settings.schemas.js";
import type { SettingsService } from "./settings.service.js";

export function createSettingsController(settings: SettingsService) {
  const get: RequestHandler = async (_req, res) => { res.json(await settings.limits()); };

  const update: RequestHandler = async (_req, res) => {
    const body = res.locals.validated.body as z.infer<typeof settingsBody>;
    res.json(await settings.update(currentAuth(res), body));
  };

  return { get, update };
}
