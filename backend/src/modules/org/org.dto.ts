import type { Department, Dealership, Facility, Grant, Role, User } from "./org.models.js";

/* API shapes. They match frontend/src/types/index.ts so the frontend can switch from seed data
   to the API without reshaping. Password fields never leave this module. */

export interface UserDto {
  id: string;
  empCode: string;
  name: string;
  role: Role;
  title: string;
  facilityId: string | null;
  deptId: string | null;
  dealershipIds: string[];
  noLogin?: true;
  inactive?: true;
  approvalLimit: number | null;
  grants: Grant[];
}

export function toUserDto(u: User): UserDto {
  return {
    id: u.id,
    empCode: u.empCode,
    name: u.name,
    role: u.role,
    title: u.title,
    facilityId: u.facilityId,
    deptId: u.deptId,
    dealershipIds: (u.dealerships ?? []).map((d) => d.id).sort(),
    ...(u.canLogin ? {} : { noLogin: true as const }),
    ...(u.inactive ? { inactive: true as const } : {}),
    approvalLimit: u.approvalLimit === null ? null : Number(u.approvalLimit),
    grants: u.grants,
  };
}

export function toDealershipDto(d: Dealership) {
  return {
    id: d.id, short: d.short, name: d.name, brand: d.brand, code: d.code, headId: d.headId,
    territory: d.territory, active: d.active,
    ...(d.isCorporate ? { isCorporate: true as const } : {}),
    ...(d.note ? { note: d.note } : {}),
  };
}

export function toFacilityDto(f: Facility) {
  return { id: f.id, dealershipId: f.dealershipId, name: f.name, type: f.type, district: f.district, active: f.active };
}

export function toDepartmentDto(d: Department) {
  return { id: d.id, name: d.name, dualAuthority: d.dualAuthority, functionalHeadId: d.functionalHeadId, active: d.active };
}
