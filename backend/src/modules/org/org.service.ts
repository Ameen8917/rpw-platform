import { randomBytes } from "node:crypto";
import { UniqueConstraintError } from "sequelize";
import { HttpError } from "../../lib/http-error.js";
import { auditRepository, type AuditRepository } from "../audit/audit.repository.js";
import { hashPassword } from "../auth/password.js";
import type { AuthContext } from "../auth/auth.service.js";
import { toDealershipDto, toDepartmentDto, toFacilityDto, toUserDto } from "./org.dto.js";
import type { Role } from "./org.models.js";
import { orgRepository, type OrgRepository } from "./org.repository.js";
import type {
  AuthorityInput, BulkPeopleInput, DealershipInput, DepartmentInput, FacilityInput, HandoverInput, PersonInput,
} from "./org.schemas.js";

/* A 400 in the same shape the validate middleware produces, for checks that need the database */
const invalidField = (path: string, message: string) =>
  HttpError.badRequest("Request is invalid", [{ location: "body", path, message }]);

/* Text IDs like the seed's (D_JNS, F_K3J9X2, U_7Q2M4C9A) */
const newId = (prefix: string, length = 6) =>
  `${prefix}_${randomBytes(8).toString("base64url").replace(/[-_]/g, "").slice(0, length).toUpperCase()}`;

const ROLE_LABEL: Record<Role, string> = {
  director: "Director", functional_head: "Corporate functional head", business_head: "Business Head",
  manager: "Dealership manager", accounts_executive: "Accounts executive", staff: "Staff — no login",
};
const inrShort = (n: number) => (n >= 100000 ? `₹${+(n / 100000).toFixed(2)}L` : `₹${n.toLocaleString("en-IN")}`);

/* Reference data. Every signed-in user may read it: pickers, labels and scoping on the frontend
   all need the full directory. The Admin console (Director and admin_console grant) writes it;
   each write is audited in its transaction. */
export function createOrgService(repo: OrgRepository = orgRepository, opts: { auditRepo?: AuditRepository } = {}) {
  const auditRepo = opts.auditRepo ?? auditRepository;

  const admin = (auth: AuthContext) => {
    if (!auth.permissions.canAdminConsole) throw HttpError.forbidden();
  };
  /* R8: only the Director creates, changes or hands over a Director */
  const directorOnly = (auth: AuthContext, ...roles: (Role | undefined)[]) => {
    if (roles.includes("director") && !auth.permissions.isDirector) throw HttpError.forbidden("Only the Director can change a Director's authority");
  };

  const unique = async <T>(work: () => Promise<T>, message: string) => {
    try {
      return await work();
    } catch (err) {
      if (err instanceof UniqueConstraintError) throw HttpError.conflict(message);
      throw err;
    }
  };

  async function activeDealership(id: string, path: string) {
    const d = await repo.findDealershipById(id);
    if (!d?.active) throw invalidField(path, "No active dealership with this ID");
    return d;
  }

  /* An active location of the dealership and an active department, where given */
  async function placeOf(input: { dealershipId: string; facilityId: string | null; deptId: string | null }) {
    if (input.facilityId) {
      const f = await repo.findFacilityById(input.facilityId);
      if (!f?.active || f.dealershipId !== input.dealershipId) throw invalidField("facilityId", "Not an active location of this dealership");
    }
    if (input.deptId) {
      const d = await repo.findDepartmentById(input.deptId);
      if (!d?.active) throw invalidField("deptId", "No active department with this ID");
    }
  }

  async function personWithRole(id: string | null, roles: Role[], path: string) {
    if (!id) return null;
    const u = await repo.findUserById(id);
    if (!u || u.inactive || !roles.includes(u.role)) throw invalidField(path, `Choose an active ${roles.map((r) => ROLE_LABEL[r]).join(" or ")}`);
    return u;
  }

  async function freeEmpCodes(codes: string[]) {
    const lower = codes.map((c) => c.toLowerCase());
    const repeated = lower.filter((c, i) => lower.indexOf(c) !== i);
    if (repeated.length) throw HttpError.conflict(`Employee code listed twice: ${[...new Set(repeated)].join(", ")}`);
    const taken = (await Promise.all(codes.map((c) => repo.findUserByEmpCode(c)))).filter(Boolean).map((u) => u!.empCode);
    if (taken.length) throw HttpError.conflict(`Employee code already exists: ${taken.join(", ")}`);
  }

  async function user(id: string) {
    const u = await repo.findUserById(id);
    if (!u) throw HttpError.notFound("No person with this ID");
    return u;
  }

  const userDto = async (id: string) => toUserDto((await repo.findUserById(id))!);

  return {
    async dealerships() { return (await repo.listDealerships()).map(toDealershipDto); },
    async facilities() { return (await repo.listFacilities()).map(toFacilityDto); },
    async departments() { return (await repo.listDepartments()).map(toDepartmentDto); },
    async users() { return (await repo.listUsers()).map(toUserDto); },

    async addDealership(auth: AuthContext, input: DealershipInput) {
      admin(auth);
      await personWithRole(input.headId, ["business_head", "director"], "headId");
      const created = await unique(() => repo.transaction(async (t) => {
        const d = await repo.createDealership({
          id: `D_${input.short}`, short: input.short, name: input.name, brand: input.brand, code: input.code,
          headId: input.headId, territory: input.territory, active: true, isCorporate: false, note: null,
        }, t);
        await auditRepo.record({ actorId: auth.user.id, action: "Created dealership", ref: input.code, detail: `${input.name} · ${input.brand}` }, t);
        return d;
      }), "A dealership with this short code or dealer code already exists");
      return toDealershipDto(created);
    },

    async addFacility(auth: AuthContext, input: FacilityInput) {
      admin(auth);
      await activeDealership(input.dealershipId, "dealershipId");
      const created = await repo.transaction(async (t) => {
        const f = await repo.createFacility({ id: newId("F"), ...input, active: true }, t);
        await auditRepo.record({ actorId: auth.user.id, action: "Created facility", ref: input.name, detail: `${input.type} · ${input.district}` }, t);
        return f;
      });
      return toFacilityDto(created);
    },

    async addDepartment(auth: AuthContext, input: DepartmentInput) {
      admin(auth);
      await personWithRole(input.functionalHeadId, ["functional_head"], "functionalHeadId");
      const created = await unique(() => repo.transaction(async (t) => {
        const d = await repo.createDepartment({ id: newId("DEP"), ...input, active: true }, t);
        await auditRepo.record({
          actorId: auth.user.id, action: "Created department", ref: input.name,
          detail: input.dualAuthority ? "Dual authority" : "Business Head only",
        }, t);
        return d;
      }), "A department with this name already exists");
      return toDepartmentDto(created);
    },

    /* Activate or deactivate a dealership, location or department */
    async setActive(auth: AuthContext, kind: "dealership" | "facility" | "department", id: string, active: boolean) {
      admin(auth);
      const found = kind === "dealership" ? await repo.findDealershipById(id)
        : kind === "facility" ? await repo.findFacilityById(id) : await repo.findDepartmentById(id);
      if (!found) throw HttpError.notFound(`No ${kind} with this ID`);
      await repo.transaction(async (t) => {
        await repo.setActive(kind, id, active, t);
        await auditRepo.record({ actorId: auth.user.id, action: "Updated master data", ref: id, detail: `${kind} ${active ? "activated" : "deactivated"}` }, t);
      });
      const fresh = kind === "dealership" ? toDealershipDto((await repo.findDealershipById(id))!)
        : kind === "facility" ? toFacilityDto((await repo.findFacilityById(id))!) : toDepartmentDto((await repo.findDepartmentById(id))!);
      return fresh;
    },

    /* One person. Anyone but staff gets a login with the initial password given (R9). */
    async addPerson(auth: AuthContext, input: PersonInput) {
      admin(auth);
      directorOnly(auth, input.role);
      await activeDealership(input.dealershipId, "dealershipId");
      await placeOf(input);
      await freeEmpCodes([input.empCode]);
      const canLogin = input.role !== "staff";
      const passwordHash = canLogin ? await hashPassword(input.password!) : null;
      const id = await unique(() => repo.transaction(async (t) => {
        const u = await repo.createUser({
          id: newId("U", 8), empCode: input.empCode, name: input.name, role: input.role, title: input.title,
          facilityId: input.facilityId, deptId: input.deptId, canLogin, approvalLimit: null,
          passwordHash, passwordChangedAt: canLogin ? new Date() : null,
        }, [input.dealershipId], t);
        await auditRepo.record({ actorId: auth.user.id, action: "Added employee", ref: input.empCode, detail: `${input.name} · ${input.title}` }, t);
        return u.id;
      }), "Employee code already exists");
      return userDto(id);
    },

    /* A pasted list of frontline staff (no logins), all in one place */
    async addPeople(auth: AuthContext, input: BulkPeopleInput) {
      admin(auth);
      await activeDealership(input.dealershipId, "dealershipId");
      await placeOf(input);
      await freeEmpCodes(input.people.map((p) => p.empCode));
      const ids = await unique(() => repo.transaction(async (t) => {
        const created: string[] = [];
        for (const p of input.people) {
          const u = await repo.createUser({
            id: newId("U", 8), empCode: p.empCode, name: p.name, role: "staff", title: p.title,
            facilityId: input.facilityId, deptId: input.deptId, canLogin: false, approvalLimit: null,
            passwordHash: null, passwordChangedAt: null,
          }, [input.dealershipId], t);
          created.push(u.id);
        }
        await auditRepo.record({
          actorId: auth.user.id, action: "Imported employees", ref: `${input.people.length} records`,
          detail: input.people.map((p) => p.empCode).join(", ").slice(0, 500),
        }, t);
        return created;
      }), "Employee code already exists");
      return Promise.all(ids.map(userDto));
    },

    /* Role, scope, department and approval limit. "Staff" removes the login. */
    async setAuthority(auth: AuthContext, id: string, input: AuthorityInput) {
      admin(auth);
      const u = await user(id);
      directorOnly(auth, u.role, input.role);
      for (const [i, d] of input.dealershipIds.entries()) await activeDealership(d, `dealershipIds.${i}`);
      if (input.deptId) await placeOf({ dealershipId: input.dealershipIds[0], facilityId: null, deptId: input.deptId });
      const staff = input.role === "staff";
      await repo.transaction(async (t) => {
        await repo.updateUser(id, {
          role: input.role, deptId: input.deptId, approvalLimit: input.approvalLimit,
          ...(staff ? { canLogin: false, passwordHash: null } : {}),
        }, input.dealershipIds, t);
        await auditRepo.record({
          actorId: auth.user.id, action: "Changed authority", ref: u.empCode,
          detail: `${u.name} → ${ROLE_LABEL[input.role]}${input.approvalLimit ? ` · limit ${inrShort(input.approvalLimit)}` : ""}`,
        }, t);
      });
      return userDto(id);
    },

    /* Someone leaves: the successor takes their role, scope, limit and personal powers, and
       every headship they held, so pending approvals move with it. Revoke deactivates the leaver. */
    async handover(auth: AuthContext, id: string, input: HandoverInput) {
      admin(auth);
      if (input.successorId === id) throw invalidField("successorId", "Choose someone else");
      const leaver = await user(id);
      const successor = await user(input.successorId);
      if (successor.inactive) throw invalidField("successorId", "This person has left");
      directorOnly(auth, leaver.role, successor.role);
      const dealershipIds = (leaver.dealerships ?? []).map((d) => d.id);
      await repo.transaction(async (t) => {
        await repo.updateUser(successor.id, {
          role: leaver.role, deptId: leaver.deptId, approvalLimit: leaver.approvalLimit,
          grants: [...new Set([...successor.grants, ...leaver.grants])],
          canLogin: leaver.role !== "staff" || successor.canLogin,
        }, dealershipIds.length ? dealershipIds : null, t);
        if (input.revoke) {
          /* No login means no password (users_no_password_without_login) */
          await repo.updateUser(leaver.id, {
            role: "staff", canLogin: false, passwordHash: null, inactive: true, approvalLimit: null, grants: [],
          }, null, t);
        }
        await repo.repointHeads(leaver.id, successor.id, t);
        await auditRepo.record({
          actorId: auth.user.id, action: "Role handover", ref: leaver.empCode,
          detail: `${leaver.name} → ${successor.name} (${successor.empCode})${input.revoke ? " · access revoked" : ""}`,
        }, t);
      });
      return { leaver: await userDto(leaver.id), successor: await userDto(successor.id) };
    },
  };
}

export type OrgService = ReturnType<typeof createOrgService>;
