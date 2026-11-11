import type { RequestHandler } from "express";
import type { z } from "zod";
import { currentAuth } from "../auth/auth.middleware.js";
import type {
  activeBody, authorityBody, bulkPeopleBody, dealershipBody, departmentBody, facilityBody, handoverBody, orgIdParams, personBody,
} from "./org.schemas.js";
import type { OrgService } from "./org.service.js";

export function createOrgController(org: OrgService) {
  const list = (load: () => Promise<unknown>): RequestHandler => async (_req, res) => { res.json(await load()); };
  const body = <T>(res: Parameters<RequestHandler>[1]) => res.locals.validated.body as T;
  const idOf = (res: Parameters<RequestHandler>[1]) => (res.locals.validated.params as z.infer<typeof orgIdParams>).id;

  const created = (add: (res: Parameters<RequestHandler>[1]) => Promise<unknown>): RequestHandler =>
    async (_req, res) => { res.status(201).json(await add(res)); };

  const activate = (kind: "dealership" | "facility" | "department"): RequestHandler => async (_req, res) => {
    res.json(await org.setActive(currentAuth(res), kind, idOf(res), body<z.infer<typeof activeBody>>(res).active));
  };

  return {
    dealerships: list(org.dealerships),
    facilities: list(org.facilities),
    departments: list(org.departments),
    users: list(org.users),

    addDealership: created((res) => org.addDealership(currentAuth(res), body<z.infer<typeof dealershipBody>>(res))),
    addFacility: created((res) => org.addFacility(currentAuth(res), body<z.infer<typeof facilityBody>>(res))),
    addDepartment: created((res) => org.addDepartment(currentAuth(res), body<z.infer<typeof departmentBody>>(res))),
    addPerson: created((res) => org.addPerson(currentAuth(res), body<z.infer<typeof personBody>>(res))),
    addPeople: created((res) => org.addPeople(currentAuth(res), body<z.infer<typeof bulkPeopleBody>>(res))),
    setDealershipActive: activate("dealership"),
    setFacilityActive: activate("facility"),
    setDepartmentActive: activate("department"),
    setAuthority: (async (_req, res) => {
      res.json(await org.setAuthority(currentAuth(res), idOf(res), body<z.infer<typeof authorityBody>>(res)));
    }) as RequestHandler,
    handover: (async (_req, res) => {
      res.json(await org.handover(currentAuth(res), idOf(res), body<z.infer<typeof handoverBody>>(res)));
    }) as RequestHandler,
  };
}
