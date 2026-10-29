import { toDealershipDto, toDepartmentDto, toFacilityDto, toUserDto } from "./org.dto.js";
import { orgRepository, type OrgRepository } from "./org.repository.js";

/* Read-only reference data. Every signed-in user may read it: pickers, labels and scoping
   on the frontend all need the full directory. */
export function createOrgService(repo: OrgRepository = orgRepository) {
  return {
    async dealerships() { return (await repo.listDealerships()).map(toDealershipDto); },
    async facilities() { return (await repo.listFacilities()).map(toFacilityDto); },
    async departments() { return (await repo.listDepartments()).map(toDepartmentDto); },
    async users() { return (await repo.listUsers()).map(toUserDto); },
  };
}

export type OrgService = ReturnType<typeof createOrgService>;
