import { Op, type Sequelize } from "sequelize";
import { Asset, AssetAccessory } from "../../modules/assets/assets.models.js";
import { AuditEntry } from "../../modules/audit/audit.models.js";
import { SEED_ASSETS, SEED_AUDIT } from "./asset-data.js";

export interface AssetSeedResult {
  assets: number;
  accessories: number;
  auditEntries: number;
}

/* Inserts the prototype's assets (with accessories) and audit entries that are not there yet.
   Unlike org data, existing rows are never updated: assets change through the app (custody,
   disposal) and the audit log is append-only. Run after seedOrg; models must be initialised. */
export async function seedAssets(sequelize: Sequelize): Promise<AssetSeedResult> {
  return sequelize.transaction(async (transaction) => {
    const existing = new Set((await Asset.findAll({
      where: { id: { [Op.in]: SEED_ASSETS.map((a) => a.id) } }, attributes: ["id"], transaction,
    })).map((a) => a.id));
    const fresh = SEED_ASSETS.filter((a) => !existing.has(a.id));

    await Asset.bulkCreate(fresh.map(({ accessories: _, ...a }) => ({
      ...a, issuedBy: null, issuedAt: null, verified: null, invoiceDoc: null, createdBy: null,
    })), { transaction });
    const accessories = fresh.flatMap((a) => a.accessories.map((x, i) => ({
      ...x, assetId: a.id, position: i + 1, createdBy: null,
    })));
    await AssetAccessory.bulkCreate(accessories, { transaction });

    /* Seed tag IDs are explicit; move the sequence past them so new assets do not collide */
    if (fresh.length) {
      const t = Asset.getTableName() as unknown as { schema: string };
      await sequelize.query(
        `SELECT setval('"${t.schema}".asset_tag_seq', (SELECT max(tag_id) FROM "${t.schema}".assets))`,
        { transaction },
      );
    }

    const logged = new Set((await AuditEntry.findAll({
      where: { id: { [Op.in]: SEED_AUDIT.map((e) => e.id) } }, attributes: ["id"], transaction,
    })).map((e) => e.id));
    const audit = SEED_AUDIT.filter((e) => !logged.has(e.id)).map((e) => ({ ...e, at: new Date(`${e.at}+05:30`) }));
    await AuditEntry.bulkCreate(audit, { transaction });

    return { assets: fresh.length, accessories: accessories.length, auditEntries: audit.length };
  });
}
