import { Router, type RequestHandler } from "express";
import { validate } from "../../middleware/validate.js";
import { createOrgController } from "./org.controller.js";
import {
  activeBody, authorityBody, bulkPeopleBody, dealershipBody, departmentBody, facilityBody, handoverBody, orgIdParams, personBody,
} from "./org.schemas.js";
import type { OrgService } from "./org.service.js";

/* GET /api/org/{dealerships|facilities|departments|users} — signed-in users.
   POST / PATCH — the Admin console (checked in the service). */
export function orgRoutes(org: OrgService, requireAuth: RequestHandler): Router {
  const c = createOrgController(org);
  const router = Router();
  router.use(requireAuth);
  router.get("/dealerships", c.dealerships);
  router.get("/facilities", c.facilities);
  router.get("/departments", c.departments);
  router.get("/users", c.users);

  router.post("/dealerships", validate({ body: dealershipBody }), c.addDealership);
  router.post("/facilities", validate({ body: facilityBody }), c.addFacility);
  router.post("/departments", validate({ body: departmentBody }), c.addDepartment);
  router.post("/users", validate({ body: personBody }), c.addPerson);
  router.post("/users/bulk", validate({ body: bulkPeopleBody }), c.addPeople);
  router.patch("/dealerships/:id", validate({ params: orgIdParams, body: activeBody }), c.setDealershipActive);
  router.patch("/facilities/:id", validate({ params: orgIdParams, body: activeBody }), c.setFacilityActive);
  router.patch("/departments/:id", validate({ params: orgIdParams, body: activeBody }), c.setDepartmentActive);
  router.patch("/users/:id", validate({ params: orgIdParams, body: authorityBody }), c.setAuthority);
  router.post("/users/:id/handover", validate({ params: orgIdParams, body: handoverBody }), c.handover);
  return router;
}
