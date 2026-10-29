import { Op, type Sequelize } from "sequelize";
import { hashPassword } from "../../modules/auth/password.js";
import { Department, Dealership, Facility, User, UserDealership } from "../../modules/org/org.models.js";
import { SEED_DEALERSHIPS, SEED_DEPARTMENTS, SEED_FACILITIES, SEED_GRANTS, SEED_USERS } from "./org-data.js";

export interface SeedResult {
  dealerships: number;
  facilities: number;
  departments: number;
  users: number;
  passwordsSet: number;
}

/* Upserts the prototype's organisation in one transaction (heads are deferred foreign keys).
   Safe to re-run: records are updated in place, and a password is only set for users who can
   sign in and do not have one yet — existing passwords are never overwritten. Models must be
   initialised on `sequelize` first. */
export async function seedOrg(sequelize: Sequelize, opts: { initialPassword: string }): Promise<SeedResult> {
  const fields = <T extends object>(row: T) => Object.keys(row).filter((k) => k !== "id") as (keyof T)[];

  const dealerships = SEED_DEALERSHIPS.map((d) => ({
    id: d.id, short: d.short, name: d.name, brand: d.brand, code: d.code, headId: d.headId,
    territory: d.territory, active: d.active, isCorporate: "isCorporate" in d ? !!d.isCorporate : false,
    note: "note" in d ? (d.note as string) : null,
  }));
  const facilities = SEED_FACILITIES.map((f) => ({ ...f }));
  const departments = SEED_DEPARTMENTS.map((d) => ({ ...d }));
  const users = SEED_USERS.map((u) => ({
    id: u.id, empCode: u.empCode, name: u.name, role: u.role, title: u.title,
    facilityId: u.facilityId, deptId: u.deptId, canLogin: !u.noLogin, grants: SEED_GRANTS[u.id] ?? [],
  }));
  const links = SEED_USERS.flatMap((u) => u.dealershipIds.map((dealershipId) => ({ userId: u.id, dealershipId })));

  return sequelize.transaction(async (transaction) => {
    await Dealership.bulkCreate(dealerships, { transaction, updateOnDuplicate: [...fields(dealerships[0]), "updatedAt"] });
    await Facility.bulkCreate(facilities, { transaction, updateOnDuplicate: [...fields(facilities[0]), "updatedAt"] });
    await Department.bulkCreate(departments, { transaction, updateOnDuplicate: [...fields(departments[0]), "updatedAt"] });
    await User.bulkCreate(users.map((u) => ({ ...u, passwordHash: null, passwordChangedAt: null, approvalLimit: null })), {
      transaction,
      /* password columns deliberately absent: re-seeding must not reset passwords */
      updateOnDuplicate: [...fields(users[0]), "updatedAt"],
    });

    /* Dealership membership mirrors the seed exactly for seeded users */
    await UserDealership.destroy({ where: { userId: { [Op.in]: users.map((u) => u.id) } }, transaction });
    await UserDealership.bulkCreate(links, { transaction });

    const needPassword = await User.findAll({
      where: { canLogin: true, passwordHash: null, id: { [Op.in]: users.map((u) => u.id) } },
      attributes: ["id"], transaction,
    });
    for (const u of needPassword) {
      await User.update(
        { passwordHash: await hashPassword(opts.initialPassword), passwordChangedAt: new Date() },
        { where: { id: u.id }, transaction },
      );
    }

    return {
      dealerships: dealerships.length, facilities: facilities.length, departments: departments.length,
      users: users.length, passwordsSet: needPassword.length,
    };
  });
}
