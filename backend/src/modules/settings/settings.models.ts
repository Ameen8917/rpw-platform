import { DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type Sequelize } from "sequelize";

/* One row per group limit (purchaseDirector, slaDays, ...). Missing rows fall back to the defaults. */
export class Setting extends Model<InferAttributes<Setting>, InferCreationAttributes<Setting>> {
  declare key: string;
  /* numeric comes back from pg as a string */
  declare value: string | number;
  declare updatedBy: string | null;
  declare updatedAt: CreationOptional<Date>;
}

export function initSettingModels(sequelize: Sequelize) {
  Setting.init({
    key: { type: DataTypes.TEXT, primaryKey: true },
    value: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    updatedBy: { type: DataTypes.STRING(40) },
    updatedAt: DataTypes.DATE,
  }, { sequelize, tableName: "settings", createdAt: false });
}
