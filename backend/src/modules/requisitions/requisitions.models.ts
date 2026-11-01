import {
  DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes,
  type NonAttribute, type Sequelize,
} from "sequelize";

export const STAGES = [
  "bh", "fn", "directorPurchase", "advanceApproval", "advanceFinance", "advanceDirector",
  "varianceApproval", "financeApproval", "directorApproval",
] as const;
export type Stage = (typeof STAGES)[number];

export const DECISIONS = ["approved", "rejected", "held", "queried"] as const;
export type Decision = (typeof DECISIONS)[number];

export const PAYMENT_KINDS = ["advance", "balance"] as const;
export type PaymentKind = (typeof PAYMENT_KINDS)[number];

/* numeric columns come back from pg as strings; DTOs convert them */
type Numeric = string | number;

export class Requisition extends Model<InferAttributes<Requisition>, InferCreationAttributes<Requisition>> {
  declare id: CreationOptional<string>;
  declare ref: string;
  declare dealershipId: string;
  declare facilityId: string | null;
  declare deptId: string;
  declare item: string;
  declare qty: number;
  declare estCost: Numeric;
  declare justification: string;
  declare raisedBy: string;
  declare raisedAt: CreationOptional<Date>;
  declare advanceRequired: boolean;
  declare advanceAmount: Numeric;
  declare advanceTerms: string;
  declare expectedDelivery: string | null;
  declare revisionOf: string | null;
  declare resubmittedAs: CreationOptional<string | null>;
  declare sentBackBy: CreationOptional<string | null>;
  declare sentBackAt: CreationOptional<Date | null>;
  declare sentBackNote: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare approvals?: NonAttribute<RequisitionApproval[]>;
  declare payments?: NonAttribute<RequisitionPayment[]>;
}

export class RequisitionApproval extends Model<InferAttributes<RequisitionApproval>, InferCreationAttributes<RequisitionApproval>> {
  declare requisitionId: string;
  declare stage: Stage;
  declare decision: Decision;
  declare decidedBy: string;
  declare decidedAt: CreationOptional<Date>;
  declare note: string;
  /** The Director decided in place of a silent approver */
  declare onBehalfOf: string | null;
  declare lateDays: number | null;
}

export class RequisitionPayment extends Model<InferAttributes<RequisitionPayment>, InferCreationAttributes<RequisitionPayment>> {
  declare requisitionId: string;
  declare kind: PaymentKind;
  declare amount: Numeric;
  declare mode: string;
  /** UTR or cheque number */
  declare ref: string;
  declare paidBy: string;
  declare paidAt: CreationOptional<Date>;
}

export class RequisitionRefSequence extends Model<InferAttributes<RequisitionRefSequence>, InferCreationAttributes<RequisitionRefSequence>> {
  declare year: number;
  declare lastValue: number;
  declare updatedAt: CreationOptional<Date>;
}

/* A fresh object per column: Sequelize writes the column name into the definition it is given */
const userRef = () => ({ type: DataTypes.STRING(40) });

export function initRequisitionModels(sequelize: Sequelize) {
  Requisition.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    ref: { type: DataTypes.TEXT, allowNull: false },
    dealershipId: { type: DataTypes.STRING(40), allowNull: false },
    facilityId: { type: DataTypes.STRING(40) },
    deptId: { type: DataTypes.STRING(40), allowNull: false },
    item: { type: DataTypes.TEXT, allowNull: false },
    qty: { type: DataTypes.INTEGER, allowNull: false },
    estCost: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    justification: { type: DataTypes.TEXT, allowNull: false },
    raisedBy: { type: DataTypes.STRING(40), allowNull: false },
    raisedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    advanceRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    advanceAmount: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    advanceTerms: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    expectedDelivery: { type: DataTypes.DATEONLY },
    revisionOf: { type: DataTypes.TEXT },
    resubmittedAs: { type: DataTypes.TEXT },
    sentBackBy: userRef(),
    sentBackAt: { type: DataTypes.DATE },
    sentBackNote: { type: DataTypes.TEXT },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, { sequelize, tableName: "requisitions" });

  RequisitionApproval.init({
    requisitionId: { type: DataTypes.UUID, primaryKey: true },
    stage: { type: DataTypes.STRING(20), primaryKey: true },
    decision: { type: DataTypes.STRING(10), allowNull: false },
    decidedBy: { type: DataTypes.STRING(40), allowNull: false },
    decidedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    note: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    onBehalfOf: userRef(),
    lateDays: { type: DataTypes.INTEGER },
  }, { sequelize, tableName: "requisition_approvals", timestamps: false });

  RequisitionPayment.init({
    requisitionId: { type: DataTypes.UUID, primaryKey: true },
    kind: { type: DataTypes.STRING(10), primaryKey: true },
    amount: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    mode: { type: DataTypes.TEXT, allowNull: false },
    ref: { type: DataTypes.TEXT, allowNull: false },
    paidBy: { type: DataTypes.STRING(40), allowNull: false },
    paidAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  }, { sequelize, tableName: "requisition_payments", timestamps: false });

  RequisitionRefSequence.init({
    year: { type: DataTypes.INTEGER, primaryKey: true },
    lastValue: { type: DataTypes.INTEGER, allowNull: false },
    updatedAt: DataTypes.DATE,
  }, { sequelize, tableName: "requisition_ref_sequences", createdAt: false });

  Requisition.hasMany(RequisitionApproval, { foreignKey: "requisitionId", as: "approvals" });
  Requisition.hasMany(RequisitionPayment, { foreignKey: "requisitionId", as: "payments" });
}
