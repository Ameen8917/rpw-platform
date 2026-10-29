import {
  DataTypes, Model, type CreationOptional, type InferAttributes, type InferCreationAttributes,
  type NonAttribute, type Sequelize,
} from "sequelize";
import { StoredFile } from "../files/files.models.js";
import type { AssetCategory, AssetSource, AssetStatus } from "./asset-rules.js";

/** Invoice details kept with an asset. The file itself is stored separately (M4). */
export interface InvoiceDoc {
  fileName?: string;
  vendor?: string;
  invoiceNo?: string;
  invoiceDate?: string;
  total?: number;
}

/* numeric columns come back from pg as strings; DTOs convert them */
type Numeric = string | number;

export class Asset extends Model<InferAttributes<Asset>, InferCreationAttributes<Asset>> {
  declare id: CreationOptional<string>;
  declare code: string;
  declare tagId: CreationOptional<number>;
  declare name: string;
  declare category: AssetCategory;
  declare make: string;
  declare model: string;
  declare serial: string;
  declare purchaseDate: string | null;
  declare cost: Numeric;
  declare vendor: string;
  declare dealershipId: string;
  declare facilityId: string | null;
  declare deptId: string | null;
  declare warranty: string | null;
  declare status: AssetStatus;
  declare source: AssetSource;
  declare reqRef: string | null;
  declare assignedTo: string | null;
  declare issuedBy: string | null;
  declare issuedAt: Date | null;
  declare verified: boolean | null;
  declare invoiceDoc: InvoiceDoc | null;
  declare createdBy: string | null;
  /* Current custody: the issue that put it with its holder, the event that acknowledged that
     (a signed issue, or the holder's acceptance), and the last return */
  declare custodyEventId: CreationOptional<string | null>;
  declare acceptanceEventId: CreationOptional<string | null>;
  declare returnEventId: CreationOptional<string | null>;
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;

  declare accessories?: NonAttribute<AssetAccessory[]>;
  declare custodyEvent?: NonAttribute<CustodyEvent | null>;
  declare acceptanceEvent?: NonAttribute<CustodyEvent | null>;
  declare returnEvent?: NonAttribute<CustodyEvent | null>;
  declare custodyHistory?: NonAttribute<CustodyEvent[]>;
}

export const RETURN_CONDITIONS = ["Good", "Minor damage", "Damaged — needs repair", "Not working"] as const;
export type ReturnCondition = (typeof RETURN_CONDITIONS)[number];

export class CustodyEvent extends Model<InferAttributes<CustodyEvent>, InferCreationAttributes<CustodyEvent>> {
  declare id: CreationOptional<string>;
  declare assetId: string;
  declare kind: "issue" | "accept" | "return";
  declare at: CreationOptional<Date>;
  declare holderId: string;
  declare actorId: string;
  declare method: "in_app" | "signature" | null;
  declare snapshot: string[];
  declare signatureFileId: string | null;
  declare note: string | null;
  declare condition: ReturnCondition | null;
  declare missing: string[];

  declare signatureFile?: NonAttribute<StoredFile | null>;
}

export class AssetAccessory extends Model<InferAttributes<AssetAccessory>, InferCreationAttributes<AssetAccessory>> {
  declare id: CreationOptional<string>;
  declare assetId: string;
  declare position: number;
  declare name: string;
  declare serial: string;
  declare origin: "bundled" | "separate";
  declare cost: Numeric;
  declare addedAt: string;
  declare status: CreationOptional<string>;
  declare createdBy: string | null;
  declare createdAt: CreationOptional<Date>;
}

export class AssetCodeSequence extends Model<InferAttributes<AssetCodeSequence>, InferCreationAttributes<AssetCodeSequence>> {
  declare prefix: string;
  declare lastValue: number;
  declare updatedAt: CreationOptional<Date>;
}

const uuid = () => ({ type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 });
/* A fresh object per column: Sequelize writes the column name into the definition it is given */
const userRef = () => ({ type: DataTypes.STRING(40) });

export function initAssetModels(sequelize: Sequelize) {
  Asset.init({
    id: uuid(),
    code: { type: DataTypes.TEXT, allowNull: false },
    /* NOT NULL in the database, which assigns it from asset_tag_seq when omitted */
    tagId: { type: DataTypes.INTEGER },
    name: { type: DataTypes.TEXT, allowNull: false },
    category: { type: DataTypes.TEXT, allowNull: false },
    make: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    model: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    serial: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    purchaseDate: { type: DataTypes.DATEONLY },
    cost: { type: DataTypes.DECIMAL(14, 2), allowNull: false },
    vendor: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    dealershipId: { type: DataTypes.STRING(40), allowNull: false },
    facilityId: { type: DataTypes.STRING(40) },
    deptId: { type: DataTypes.STRING(40) },
    warranty: { type: DataTypes.DATEONLY },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "in_use" },
    source: { type: DataTypes.STRING(20), allowNull: false },
    reqRef: { type: DataTypes.TEXT },
    assignedTo: userRef(),
    issuedBy: userRef(),
    issuedAt: { type: DataTypes.DATE },
    verified: { type: DataTypes.BOOLEAN },
    invoiceDoc: { type: DataTypes.JSONB },
    createdBy: userRef(),
    custodyEventId: { type: DataTypes.UUID },
    acceptanceEventId: { type: DataTypes.UUID },
    returnEventId: { type: DataTypes.UUID },
    createdAt: DataTypes.DATE,
    updatedAt: DataTypes.DATE,
  }, { sequelize, tableName: "assets" });

  CustodyEvent.init({
    id: uuid(),
    assetId: { type: DataTypes.UUID, allowNull: false },
    kind: { type: DataTypes.STRING(10), allowNull: false },
    at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    holderId: { type: DataTypes.STRING(40), allowNull: false },
    actorId: { type: DataTypes.STRING(40), allowNull: false },
    method: { type: DataTypes.STRING(10) },
    snapshot: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] },
    signatureFileId: { type: DataTypes.UUID },
    note: { type: DataTypes.TEXT },
    condition: { type: DataTypes.TEXT },
    missing: { type: DataTypes.ARRAY(DataTypes.TEXT), allowNull: false, defaultValue: [] },
  }, { sequelize, tableName: "asset_custody_events", timestamps: false });

  AssetAccessory.init({
    id: uuid(),
    assetId: { type: DataTypes.UUID, allowNull: false },
    position: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.TEXT, allowNull: false },
    serial: { type: DataTypes.TEXT, allowNull: false, defaultValue: "—" },
    origin: { type: DataTypes.STRING(10), allowNull: false },
    cost: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
    addedAt: { type: DataTypes.DATEONLY, allowNull: false },
    status: { type: DataTypes.TEXT, allowNull: false, defaultValue: "with_asset" },
    createdBy: userRef(),
    createdAt: DataTypes.DATE,
  }, { sequelize, tableName: "asset_accessories", updatedAt: false });

  AssetCodeSequence.init({
    prefix: { type: DataTypes.TEXT, primaryKey: true },
    lastValue: { type: DataTypes.INTEGER, allowNull: false },
    updatedAt: DataTypes.DATE,
  }, { sequelize, tableName: "asset_code_sequences", createdAt: false });

  Asset.hasMany(AssetAccessory, { foreignKey: "assetId", as: "accessories" });
  Asset.belongsTo(CustodyEvent, { foreignKey: "custodyEventId", as: "custodyEvent", constraints: false });
  Asset.belongsTo(CustodyEvent, { foreignKey: "acceptanceEventId", as: "acceptanceEvent", constraints: false });
  Asset.belongsTo(CustodyEvent, { foreignKey: "returnEventId", as: "returnEvent", constraints: false });
  Asset.hasMany(CustodyEvent, { foreignKey: "assetId", as: "custodyHistory", constraints: false });
  CustodyEvent.belongsTo(StoredFile, { foreignKey: "signatureFileId", as: "signatureFile", constraints: false });
}
