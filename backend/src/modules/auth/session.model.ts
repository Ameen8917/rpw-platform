import {
  DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes,
  type NonAttribute, type Sequelize,
} from "sequelize";
import { User } from "../org/org.models.js";

export class Session extends Model<InferAttributes<Session>, InferCreationAttributes<Session>> {
  /** HMAC-SHA256(SESSION_SECRET, cookie token), hex */
  declare idHash: string;
  declare userId: string;
  declare expiresAt: Date;
  declare userAgent: string | null;
  declare ip: string | null;
  declare createdAt: CreationOptional<Date>;

  declare user?: NonAttribute<User>;
}

export function initSessionModel(sequelize: Sequelize) {
  Session.init({
    idHash: { type: DataTypes.CHAR(64), primaryKey: true },
    userId: { type: DataTypes.STRING(40), allowNull: false },
    expiresAt: { type: DataTypes.DATE, allowNull: false },
    userAgent: { type: DataTypes.TEXT },
    ip: { type: DataTypes.TEXT },
    createdAt: DataTypes.DATE,
  }, { sequelize, tableName: "sessions", updatedAt: false });

  Session.belongsTo(User, { foreignKey: "userId", as: "user" });
}
