import { z } from "zod";
import { FACILITY_TYPES, ROLES } from "./org.models.js";

/* Admin console writes (docs/requisitions.md, section 6). Reads need no input. */

const text = (max: number) => z.string().trim().max(max);
const id = () => text(40).min(1);
/* "" (an unselected <select>) and null both mean "none" */
const optionalId = text(40).nullish().transform((v) => v || null);

export const orgIdParams = z.object({ id: id() });

export const activeBody = z.object({ active: z.boolean() }).strict();

export const dealershipBody = z.object({
  name: text(200).min(1, "Name is required"),
  /** Used in asset codes: RPW/<short>/... */
  short: z.string().trim().toUpperCase().regex(/^[A-Z]{2,5}$/, "2 to 5 letters"),
  brand: text(100).min(1, "Brand is required"),
  code: text(40).min(1, "Dealer code is required"),
  headId: optionalId,
  territory: z.array(text(100).min(1)).max(50).default([]),
}).strict();
export type DealershipInput = z.infer<typeof dealershipBody>;

export const facilityBody = z.object({
  dealershipId: id(),
  name: text(200).min(1, "Name is required"),
  type: z.enum(FACILITY_TYPES),
  district: text(100).min(1, "District is required"),
}).strict();
export type FacilityInput = z.infer<typeof facilityBody>;

export const departmentBody = z.object({
  name: text(100).min(1, "Name is required"),
  dualAuthority: z.boolean(),
  functionalHeadId: optionalId,
}).strict().superRefine((d, ctx) => {
  if (d.dualAuthority && !d.functionalHeadId) {
    ctx.addIssue({ code: "custom", path: ["functionalHeadId"], message: "A dual-authority department needs its functional head" });
  }
});
export type DepartmentInput = z.infer<typeof departmentBody>;

const empCode = () => text(40).min(1, "Employee code is required");

export const personBody = z.object({
  name: text(200).min(1, "Name is required"),
  empCode: empCode(),
  title: text(200).transform((v) => v || "—").default("—"),
  dealershipId: id(),
  facilityId: optionalId,
  deptId: optionalId,
  role: z.enum(ROLES),
  /** Required (10+ characters) when the person gets a login, i.e. any role but staff */
  password: z.string().max(200).optional(),
}).strict().superRefine((p, ctx) => {
  if (p.role !== "staff" && (p.password ?? "").length < 10) {
    ctx.addIssue({ code: "custom", path: ["password"], message: "Set an initial password of at least 10 characters" });
  }
  if (p.role === "staff" && p.password) {
    ctx.addIssue({ code: "custom", path: ["password"], message: "Staff without a login have no password" });
  }
});
export type PersonInput = z.infer<typeof personBody>;

/* A pasted list of frontline staff: no logins */
export const bulkPeopleBody = z.object({
  dealershipId: id(),
  facilityId: optionalId,
  deptId: optionalId,
  people: z.array(z.object({
    name: text(200).min(1, "Name is required"),
    empCode: empCode(),
    title: text(200).transform((v) => v || "—").default("—"),
  }).strict()).min(1, "Nobody to add").max(2000),
}).strict();
export type BulkPeopleInput = z.infer<typeof bulkPeopleBody>;

export const authorityBody = z.object({
  role: z.enum(ROLES),
  deptId: optionalId,
  dealershipIds: z.array(id()).min(1, "Choose a dealership").max(20),
  approvalLimit: z.number().positive().max(1e11).nullish().transform((v) => v ?? null),
}).strict();
export type AuthorityInput = z.infer<typeof authorityBody>;

export const handoverBody = z.object({
  successorId: id(),
  /** Deactivate the leaver now: no login, no authority, history kept */
  revoke: z.boolean(),
}).strict();
export type HandoverInput = z.infer<typeof handoverBody>;
