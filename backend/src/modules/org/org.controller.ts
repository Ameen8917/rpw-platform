import type { RequestHandler } from "express";
import type { OrgService } from "./org.service.js";

export function createOrgController(org: OrgService) {
  const list = (load: () => Promise<unknown>): RequestHandler => async (_req, res) => { res.json(await load()); };
  return {
    dealerships: list(org.dealerships),
    facilities: list(org.facilities),
    departments: list(org.departments),
    users: list(org.users),
  };
}
