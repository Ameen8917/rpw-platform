import {
  DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes, type Sequelize,
} from "sequelize";

export const FILE_PURPOSES = ["signature", "invoice"] as const;
export type FilePurpose = (typeof FILE_PURPOSES)[number];

/* A file kept in Storage. The bytes are never in the database. */
export class StoredFile extends Model<InferAttributes<StoredFile>, InferCreationAttributes<StoredFile>> {
  declare id: string;
  declare bucket: string;
  declare path: string;
  declare contentType: string;
  declare sizeBytes: number;
  declare sha256: string;
  declare purpose: FilePurpose;
  declare uploadedBy: string;
  declare createdAt: CreationOptional<Date>;
}

export function initFileModels(sequelize: Sequelize) {
  StoredFile.init({
    id: { type: DataTypes.UUID, primaryKey: true },
    bucket: { type: DataTypes.TEXT, allowNull: false },
    path: { type: DataTypes.TEXT, allowNull: false },
    contentType: { type: DataTypes.TEXT, allowNull: false },
    sizeBytes: { type: DataTypes.INTEGER, allowNull: false },
    sha256: { type: DataTypes.CHAR(64), allowNull: false },
    purpose: { type: DataTypes.STRING(20), allowNull: false },
    uploadedBy: { type: DataTypes.STRING(40), allowNull: false },
    createdAt: DataTypes.DATE,
  }, { sequelize, tableName: "files", updatedAt: false });
}
