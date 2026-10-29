import {
  DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type Sequelize,
} from "sequelize";

/* Append-only (a database trigger rejects UPDATE and DELETE) */
export class AuditEntry extends Model<InferAttributes<AuditEntry>, InferCreationAttributes<AuditEntry>> {
  declare id: CreationOptional<string>;
  declare at: CreationOptional<Date>;
  declare actorId: string;
  declare action: string;
  declare ref: string;
  declare detail: string;
}

export function initAuditModels(sequelize: Sequelize) {
  AuditEntry.init({
    id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
    at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    actorId: { type: DataTypes.STRING(40), allowNull: false },
    action: { type: DataTypes.TEXT, allowNull: false },
    ref: { type: DataTypes.TEXT, allowNull: false },
    detail: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
  }, { sequelize, tableName: "audit_log", timestamps: false });
}
