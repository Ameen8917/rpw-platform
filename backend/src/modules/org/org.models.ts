import {
  DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes,
  type NonAttribute, type Sequelize,
} from "sequelize";

export const ROLES = ["director", "functional_head", "business_head", "manager", "accounts_executive", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const FACILITY_TYPES = ["3S facility", "Sales outlet", "Service outlet", "Parts outlet", "Corporate office"] as const;
export type FacilityType = (typeof FACILITY_TYPES)[number];

/* Powers held by named people rather than derived from role (prototype hardcoded these by user ID) */
export const GRANTS = ["finance_signoff", "dispose_assets", "admin_console"] as const;
export type Grant = (typeof GRANTS)[number];

export class Dealership extends Model<InferAttributes<Dealership>, InferCreationAttributes<Dealership>> {
  declare id: string;
  declare short: string;
  declare name: string;
  declare brand: string;
  declare code: string;
  declare headId: string | null;
  declare territory: string[];
  declare active: boolean;
  declare isCorporate: boolean;
  declare note: string | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class Facility extends Model<InferAttributes<Facility>, InferCreationAttributes<Facility>> {
  declare id: string;
  declare dealershipId: string;
  declare name: string;
  declare type: FacilityType;
  declare district: string;
  declare active: boolean;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class Department extends Model<InferAttributes<Department>, InferCreationAttributes<Department>> {
  declare id: string;
  declare name: string;
  declare dualAuthority: boolean;
  declare functionalHeadId: string | null;
  declare active: boolean;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
}

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: string;
  declare empCode: string;
  declare name: string;
  declare role: Role;
  declare title: string;
  declare facilityId: string | null;
  declare deptId: string | null;
  declare canLogin: boolean;
  declare inactive: CreationOptional<boolean>;
  /* numeric comes back from pg as a string; converted in toUserDto */
  declare approvalLimit: string | number | null;
  declare grants: CreationOptional<Grant[]>;
  declare passwordHash: string | null;
  declare passwordChangedAt: Date | null;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare dealerships?: NonAttribute<Dealership[]>;
}

export class UserDealership extends Model<InferAttributes<UserDealership>, InferCreationAttributes<UserDealership>> {
  declare userId: string;
  declare dealershipId: string;
}

const id = { type: DataTypes.STRING(40), primaryKey: true };
const timestamps = { createdAt: DataTypes.DATE, updatedAt: DataTypes.DATE };

export function initOrgModels(sequelize: Sequelize) {
  Dealership.init({
    id,
    short: { type: DataTypes.STRING(5), allowNull: false },
    name: { type: DataTypes.TEXT, allowNull: false },
    brand: { type: DataTypes.TEXT, allowNull: false },
    code: { type: DataTypes.STRING(40), allowNull: false },
    headId: { type: DataTypes.STRING(40) },
    territory: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    isCorporate: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    note: { type: DataTypes.TEXT },
    ...timestamps,
  }, { sequelize, tableName: "dealerships" });

  Facility.init({
    id,
    dealershipId: { type: DataTypes.STRING(40), allowNull: false },
    name: { type: DataTypes.TEXT, allowNull: false },
    type: { type: DataTypes.TEXT, allowNull: false },
    district: { type: DataTypes.TEXT, allowNull: false },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    ...timestamps,
  }, { sequelize, tableName: "facilities" });

  Department.init({
    id,
    name: { type: DataTypes.TEXT, allowNull: false },
    dualAuthority: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    functionalHeadId: { type: DataTypes.STRING(40) },
    active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    ...timestamps,
  }, { sequelize, tableName: "departments" });

  User.init({
    id,
    empCode: { type: DataTypes.STRING(40), allowNull: false },
    name: { type: DataTypes.TEXT, allowNull: false },
    role: { type: DataTypes.STRING(30), allowNull: false },
    title: { type: DataTypes.TEXT, allowNull: false },
    facilityId: { type: DataTypes.STRING(40) },
    deptId: { type: DataTypes.STRING(40) },
    canLogin: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    inactive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    approvalLimit: { type: DataTypes.DECIMAL(14, 2) },
    grants: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] },
    passwordHash: { type: DataTypes.TEXT },
    passwordChangedAt: { type: DataTypes.DATE },
    ...timestamps,
  }, { sequelize, tableName: "users" });

  UserDealership.init({
    userId: { type: DataTypes.STRING(40), primaryKey: true },
    dealershipId: { type: DataTypes.STRING(40), primaryKey: true },
  }, { sequelize, tableName: "user_dealerships", timestamps: false });

  User.belongsToMany(Dealership, { through: UserDealership, as: "dealerships", foreignKey: "userId", otherKey: "dealershipId" });
  Facility.belongsTo(Dealership, { foreignKey: "dealershipId" });
}
