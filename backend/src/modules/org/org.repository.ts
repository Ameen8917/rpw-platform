import { col, fn, Op, where } from "sequelize";
import { containsPattern } from "../../lib/like.js";
import { Department, Dealership, Facility, User } from "./org.models.js";

const withDealershipIds = { model: Dealership, as: "dealerships", attributes: ["id"], through: { attributes: [] } };

/* Database access for the organisation module. Only this file touches the org models. */
export const orgRepository = {
  listDealerships: () => Dealership.findAll({ order: [["name", "ASC"]] }),
  listFacilities: () => Facility.findAll({ order: [["dealershipId", "ASC"], ["name", "ASC"]] }),
  listDepartments: () => Department.findAll({ order: [["name", "ASC"]] }),
  listUsers: () => User.findAll({ include: [withDealershipIds], order: [["name", "ASC"]] }),

  findDealershipById: (id: string) => Dealership.findByPk(id),
  findFacilityById: (id: string) => Facility.findByPk(id),
  findDepartmentById: (id: string) => Department.findByPk(id),
  findUserById: (id: string) => User.findByPk(id, { include: [withDealershipIds] }),

  /* IDs of people whose name contains the text (audit search by actor) */
  async findUserIdsByName(text: string): Promise<string[]> {
    const rows = await User.findAll({ where: { name: { [Op.iLike]: containsPattern(text) } }, attributes: ["id"] });
    return rows.map((u) => u.id);
  },

  /* Exact match, case-insensitive (people type "rpw-emp-0001" too). Not ILIKE: a typed % or _
     would act as a wildcard and could match someone else's code. */
  findUserByEmpCode: (empCode: string) =>
    User.findOne({
      where: where(fn("lower", col("emp_code")), empCode.toLowerCase()),
      include: [withDealershipIds],
    }),
};

export type OrgRepository = typeof orgRepository;
