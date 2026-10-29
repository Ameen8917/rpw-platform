import { Router, type RequestHandler } from "express";
import { createOrgController } from "./org.controller.js";
import type { OrgService } from "./org.service.js";

/* GET /api/org/{dealerships|facilities|departments|users} — signed-in users only */
export function orgRoutes(org: OrgService, requireAuth: RequestHandler): Router {
  const c = createOrgController(org);
  const router = Router();
  router.use(requireAuth);
  router.get("/dealerships", c.dealerships);
  router.get("/facilities", c.facilities);
  router.get("/departments", c.departments);
  router.get("/users", c.users);
  return router;
}
