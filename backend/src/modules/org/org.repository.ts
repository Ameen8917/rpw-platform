import { col, fn, where, type CreationAttributes, type Transaction } from "sequelize";
import { Department, Dealership, Facility, User, UserDealership } from "./org.models.js";

const withDealershipIds = () => ({ model: Dealership, as: "dealerships", attributes: ["id"], through: { attributes: [] } });

/* Database access for the organisation module. Only this file touches the org models. */
export const orgRepository = {
  transaction: <T>(work: (t: Transaction) => Promise<T>) => User.sequelize!.transaction(work),

  listDealerships: () => Dealership.findAll({ order: [["name", "ASC"]] }),
  listFacilities: () => Facility.findAll({ order: [["dealershipId", "ASC"], ["name", "ASC"]] }),
  listDepartments: () => Department.findAll({ order: [["name", "ASC"]] }),
  listUsers: () => User.findAll({ include: [withDealershipIds()], order: [["name", "ASC"]] }),

  findDealershipById: (id: string, transaction?: Transaction) => Dealership.findByPk(id, { transaction }),
  findFacilityById: (id: string, transaction?: Transaction) => Facility.findByPk(id, { transaction }),
  findDepartmentById: (id: string, transaction?: Transaction) => Department.findByPk(id, { transaction }),
  findUserById: (id: string, transaction?: Transaction) => User.findByPk(id, { include: [withDealershipIds()], transaction }),

  /* Exact match, case-insensitive (people type "rpw-emp-0001" too). Not ILIKE: a typed % or _
     would act as a wildcard and could match someone else's code. */
  findUserByEmpCode: (empCode: string, transaction?: Transaction) =>
    User.findOne({
      where: where(fn("lower", col("emp_code")), empCode.toLowerCase()),
      include: [withDealershipIds()],
      transaction,
    }),

  /* -------- Admin console writes. Unique constraints (dealership short and code, department
     name, employee code) surface as UniqueConstraintError. -------- */

  createDealership: (d: CreationAttributes<Dealership>, transaction: Transaction) => Dealership.create(d, { transaction }),
  createFacility: (f: CreationAttributes<Facility>, transaction: Transaction) => Facility.create(f, { transaction }),
  createDepartment: (d: CreationAttributes<Department>, transaction: Transaction) => Department.create(d, { transaction }),

  setActive: (model: "dealership" | "facility" | "department", id: string, active: boolean, transaction: Transaction) => {
    const M = { dealership: Dealership, facility: Facility, department: Department }[model] as typeof Dealership;
    return M.update({ active }, { where: { id }, transaction });
  },

  async createUser(u: CreationAttributes<User>, dealershipIds: string[], transaction: Transaction) {
    const created = await User.create(u, { transaction });
    await UserDealership.bulkCreate(dealershipIds.map((dealershipId) => ({ userId: created.id, dealershipId })), { transaction });
    return created;
  },

  async updateUser(id: string, fields: Partial<CreationAttributes<User>>, dealershipIds: string[] | null, transaction: Transaction) {
    await User.update(fields, { where: { id }, transaction });
    if (dealershipIds) {
      await UserDealership.destroy({ where: { userId: id }, transaction });
      await UserDealership.bulkCreate(dealershipIds.map((dealershipId) => ({ userId: id, dealershipId })), { transaction });
    }
  },

  /* Headships follow the role: everything waiting on `from` now waits on `to` */
  async repointHeads(from: string, to: string, transaction: Transaction) {
    const [dealerships] = await Dealership.update({ headId: to }, { where: { headId: from }, transaction });
    const [departments] = await Department.update({ functionalHeadId: to }, { where: { functionalHeadId: from }, transaction });
    return { dealerships, departments };
  },
};

export type OrgRepository = typeof orgRepository;
