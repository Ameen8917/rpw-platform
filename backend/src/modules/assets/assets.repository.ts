import { col, fn, Op, QueryTypes, where, type CreationAttributes, type Includeable, type Transaction, type WhereOptions } from "sequelize";
import { containsPattern } from "../../lib/like.js";
import { StoredFile } from "../files/files.models.js";
import type { AssetScope, AssetSource, AssetStatus } from "./asset-rules.js";
import { Asset, AssetAccessory, AssetAttachment, AssetCodeSequence, AssetDisposal, AssetProcurement, CustodyEvent } from "./assets.models.js";

export interface AssetFilter {
  scope: AssetScope;
  q?: string;
  dealershipId?: string;
  source?: AssetSource;
  status?: AssetStatus;
}

export interface CustodyFilter {
  scope: AssetScope;
  dealershipId?: string;
  deptId?: string;
  facilityId?: string;
  userId?: string;
}

/* Everything an AssetDto needs: accessories, the custody events behind its current state, its disposal */
/* Factories, not shared objects: Sequelize mutates include definitions while building a query */
const withSignature = () => ({ model: StoredFile, as: "signatureFile", attributes: ["id", "path"] });
const standard = (): Includeable[] => [
  { model: AssetAccessory, as: "accessories" },
  { model: CustodyEvent, as: "custodyEvent" },
  { model: CustodyEvent, as: "acceptanceEvent", include: [withSignature()] },
  { model: CustodyEvent, as: "returnEvent", include: [withSignature()] },
  { model: AssetDisposal, as: "disposal" },
];
/* Detail adds the full custody history, newest first */
const detail = (): Includeable[] => [
  ...standard(),
  { model: CustodyEvent, as: "custodyHistory", separate: true, order: [["at", "DESC"]], include: [withSignature()] },
];

const quotedTable = (model: { getTableName(): string | object }) => {
  const t = model.getTableName() as unknown as { schema?: string; tableName: string } | string;
  return typeof t === "string" ? `"${t}"` : `"${t.schema}"."${t.tableName}"`;
};

const scoped = (scope: AssetScope): WhereOptions<Asset>[] =>
  scope.all ? [] : [{ dealershipId: { [Op.in]: scope.dealershipIds } }];

/* Database access for the asset module. Only this file touches the asset models. */
export const assetRepository = {
  transaction: <T>(work: (t: Transaction) => Promise<T>) => Asset.sequelize!.transaction(work),

  list: (f: AssetFilter) => {
    const conditions = scoped(f.scope);
    if (f.dealershipId) conditions.push({ dealershipId: f.dealershipId });
    if (f.source) conditions.push({ source: f.source });
    if (f.status) conditions.push({ status: f.status });
    if (f.q) {
      const like = containsPattern(f.q);
      conditions.push({ [Op.or]: [{ name: { [Op.iLike]: like } }, { code: { [Op.iLike]: like } }, { make: { [Op.iLike]: like } }] });
    }
    return Asset.findAll({ where: { [Op.and]: conditions }, include: standard(), order: [["createdAt", "DESC"], ["code", "ASC"]] });
  },

  /* Assets held by individuals (custody register) */
  listIssued: (f: CustodyFilter) => {
    const conditions = scoped(f.scope);
    conditions.push({ assignedTo: { [Op.ne]: null } }, { status: { [Op.ne]: "disposed" } });
    if (f.dealershipId) conditions.push({ dealershipId: f.dealershipId });
    if (f.deptId) conditions.push({ deptId: f.deptId });
    if (f.facilityId) conditions.push({ facilityId: f.facilityId });
    if (f.userId) conditions.push({ assignedTo: f.userId });
    return Asset.findAll({ where: { [Op.and]: conditions }, include: standard(), order: [["code", "ASC"]] });
  },

  findById: (id: string, transaction?: Transaction) => Asset.findByPk(id, { include: detail(), transaction }),

  /* Exact, case-insensitive (scanners and people type codes in either case) */
  findByCode: (code: string) =>
    Asset.findOne({ where: where(fn("lower", col("code")), code.toLowerCase()), include: detail() }),

  findByTagId: (tagId: number) => Asset.findOne({ where: { tagId }, include: detail() }),

  /* Locks the asset row until the transaction ends, so custody changes on one asset run one at a time */
  lockById: (id: string, transaction: Transaction) => Asset.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE }),

  accessoriesOf: (assetId: string, transaction: Transaction) =>
    AssetAccessory.findAll({ where: { assetId }, order: [["position", "ASC"]], transaction }),

  findEvent: (id: string, transaction: Transaction) => CustodyEvent.findByPk(id, { transaction }),

  createEvent: (e: CreationAttributes<CustodyEvent>, transaction: Transaction) => CustodyEvent.create(e, { transaction }),

  updateCustody: (
    asset: Asset,
    fields: Pick<CreationAttributes<Asset>, "assignedTo" | "issuedBy" | "issuedAt" | "custodyEventId" | "acceptanceEventId" | "returnEventId">,
    transaction: Transaction,
  ) => asset.update(fields, { transaction }),

  /* Takes the next number for a code prefix. The upsert holds the row lock until the caller's
     transaction ends, so concurrent adds under one prefix queue up rather than collide; if the
     transaction rolls back, the number is released with it. */
  async nextCodeNumber(prefix: string, transaction: Transaction): Promise<number> {
    const table = quotedTable(AssetCodeSequence);
    const [row] = await Asset.sequelize!.query<{ last_value: number }>(
      `INSERT INTO ${table} (prefix, last_value, updated_at) VALUES ($1, 1, now())
       ON CONFLICT (prefix) DO UPDATE SET last_value = ${table}.last_value + 1, updated_at = now()
       RETURNING last_value`,
      { bind: [prefix], type: QueryTypes.SELECT, transaction },
    );
    return row.last_value;
  },

  addAccessory: (x: CreationAttributes<AssetAccessory>, transaction: Transaction) => AssetAccessory.create(x, { transaction }),

  /* Writes the disposal record and marks the asset disposed */
  async dispose(asset: Asset, d: CreationAttributes<AssetDisposal>, transaction: Transaction) {
    await AssetDisposal.create(d, { transaction });
    await asset.update({ status: "disposed" }, { transaction });
  },

  /* Attachments still shown on the asset, oldest first, with their file (for the Storage path) */
  attachmentsOf: (assetId: string, transaction?: Transaction) =>
    AssetAttachment.findAll({
      where: { assetId, removedAt: null },
      include: [{ model: StoredFile, as: "file", attributes: ["id", "path", "contentType", "sizeBytes", "fileName"] }],
      order: [["addedAt", "ASC"], ["id", "ASC"]],
      transaction,
    }),

  findAttachment: (assetId: string, id: string, transaction: Transaction) =>
    AssetAttachment.findOne({
      where: { id, assetId },
      include: [{ model: StoredFile, as: "file", attributes: ["id", "fileName"] }],
      transaction,
    }),

  addAttachment: (x: CreationAttributes<AssetAttachment>, transaction: Transaction) => AssetAttachment.create(x, { transaction }),

  /* Hides it from the asset; the row and the file stay */
  removeAttachment: (x: AssetAttachment, removedBy: string, transaction: Transaction) =>
    x.update({ removedBy, removedAt: new Date() }, { transaction }),

  /* Assets already carrying this requisition reference (including seeded ones) */
  countByReqRef: (reqRef: string, transaction: Transaction) => Asset.count({ where: { reqRef }, transaction }),

  /* Throws UniqueConstraintError if this requisition was already procured */
  createProcurement: (p: CreationAttributes<AssetProcurement>, transaction: Transaction) => AssetProcurement.create(p, { transaction }),

  /* The purchases recorded for these requisition references, and the codes they created */
  purchasesFor: (reqRefs: string[], transaction?: Transaction) =>
    AssetProcurement.findAll({ where: { reqRef: { [Op.in]: reqRefs } }, transaction }),

  codesFor: (reqRefs: string[], transaction?: Transaction) =>
    Asset.findAll({
      where: { reqRef: { [Op.in]: reqRefs } }, attributes: ["code", "reqRef"],
      order: [["createdAt", "ASC"], ["code", "ASC"]], transaction,
    }),

  /* A reference is taken once a purchase or an asset carries it */
  async refInUse(reqRef: string, transaction: Transaction) {
    const [purchase, assets] = await Promise.all([
      AssetProcurement.count({ where: { reqRef }, transaction }),
      Asset.count({ where: { reqRef }, transaction }),
    ]);
    return purchase + assets > 0;
  },

  /* The functional head confirms a manager's entry: the purchase and its assets */
  async verifyPurchase(reqRef: string, v: { verifiedBy: string; verifiedAt: Date; verificationNote: string }, transaction: Transaction) {
    await AssetProcurement.update({ verified: true, ...v }, { where: { reqRef }, transaction });
    await Asset.update({ verified: true }, { where: { reqRef }, transaction });
  },

  /* The assets of one purchase with their full custody history and any disposal, locked */
  procuredAssets: (reqRef: string, transaction: Transaction) =>
    Asset.findAll({
      where: { reqRef },
      include: [{ model: CustodyEvent, as: "custodyHistory" }, { model: AssetDisposal, as: "disposal" }],
      transaction,
    }),

  /* A sent-back entry: its assets (accessories, custody events and disposal go with them) and
     the purchase record. The custody pointers are cleared first so no row points at a deleted one. */
  async removePurchase(reqRef: string, transaction: Transaction) {
    await Asset.update({ custodyEventId: null, acceptanceEventId: null, returnEventId: null }, { where: { reqRef }, transaction });
    await Asset.destroy({ where: { reqRef }, transaction });
    await AssetProcurement.destroy({ where: { reqRef }, transaction });
  },

  async create(
    asset: CreationAttributes<Asset>,
    accessories: Omit<CreationAttributes<AssetAccessory>, "assetId">[],
    transaction: Transaction,
  ) {
    const created = await Asset.create(asset, { transaction });
    if (accessories.length) {
      await AssetAccessory.bulkCreate(accessories.map((x) => ({ ...x, assetId: created.id })), { transaction });
    }
    return created;
  },
};

export type AssetRepository = typeof assetRepository;
