import { col, fn, Op, QueryTypes, where, type CreationAttributes, type Transaction, type WhereOptions } from "sequelize";
import type { AssetScope, AssetSource, AssetStatus } from "./asset-rules.js";
import { Asset, AssetAccessory, AssetCodeSequence } from "./assets.models.js";

export interface AssetFilter {
  scope: AssetScope;
  q?: string;
  dealershipId?: string;
  source?: AssetSource;
  status?: AssetStatus;
}

const withAccessories = { model: AssetAccessory, as: "accessories" };

/* LIKE treats % and _ as wildcards; search text is matched literally */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);

const quotedTable = (model: { getTableName(): string | object }) => {
  const t = model.getTableName() as unknown as { schema?: string; tableName: string } | string;
  return typeof t === "string" ? `"${t}"` : `"${t.schema}"."${t.tableName}"`;
};

/* Database access for the asset module. Only this file touches the asset models. */
export const assetRepository = {
  transaction: <T>(work: (t: Transaction) => Promise<T>) => Asset.sequelize!.transaction(work),

  list: (f: AssetFilter) => {
    const conditions: WhereOptions<Asset>[] = [];
    if (!f.scope.all) conditions.push({ dealershipId: { [Op.in]: f.scope.dealershipIds } });
    if (f.dealershipId) conditions.push({ dealershipId: f.dealershipId });
    if (f.source) conditions.push({ source: f.source });
    if (f.status) conditions.push({ status: f.status });
    if (f.q) {
      const like = `%${escapeLike(f.q)}%`;
      conditions.push({ [Op.or]: [{ name: { [Op.iLike]: like } }, { code: { [Op.iLike]: like } }, { make: { [Op.iLike]: like } }] });
    }
    return Asset.findAll({ where: { [Op.and]: conditions }, include: [withAccessories], order: [["createdAt", "DESC"], ["code", "ASC"]] });
  },

  findById: (id: string, transaction?: Transaction) => Asset.findByPk(id, { include: [withAccessories], transaction }),

  /* Exact, case-insensitive (scanners and people type codes in either case) */
  findByCode: (code: string) =>
    Asset.findOne({ where: where(fn("lower", col("code")), code.toLowerCase()), include: [withAccessories] }),

  findByTagId: (tagId: number) => Asset.findOne({ where: { tagId }, include: [withAccessories] }),

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
