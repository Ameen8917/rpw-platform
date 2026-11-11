import { Op, type Sequelize } from "sequelize";
import { AssetProcurement } from "../../modules/assets/assets.models.js";
import {
  Requisition, RequisitionApproval, RequisitionPayment, RequisitionRefSequence,
} from "../../modules/requisitions/requisitions.models.js";
import { Setting } from "../../modules/settings/settings.models.js";
import { LIMIT_DEFAULTS } from "../../modules/settings/settings.schemas.js";
import { SEED_REQUISITIONS } from "./requisition-data.js";

export interface RequisitionSeedResult {
  requisitions: number;
  purchases: number;
  settings: number;
}

/* Prototype timestamps without a zone are India time */
const ist = (s: string) => new Date(/[zZ]|[+-]\d\d:\d\d$/.test(s) ? s : `${s}+05:30`);

/* Inserts the prototype's requisitions (with their decisions, payments and purchases) and the
   default group limits where missing. Like assets, existing rows are never updated: they change
   through the app. A purchase is added only if none is recorded for that reference yet.
   Run after seedOrg and seedAssets; models must be initialised. */
export async function seedRequisitions(sequelize: Sequelize): Promise<RequisitionSeedResult> {
  return sequelize.transaction(async (transaction) => {
    const existing = new Set((await Requisition.findAll({
      where: { id: { [Op.in]: SEED_REQUISITIONS.map((r) => r.id) } }, attributes: ["id"], transaction,
    })).map((r) => r.id));
    const fresh = SEED_REQUISITIONS.filter((r) => !existing.has(r.id));

    await Requisition.bulkCreate(fresh.map((r) => ({
      id: r.id, ref: r.ref, dealershipId: r.dealershipId, facilityId: r.facilityId, deptId: r.deptId,
      item: r.item, qty: r.qty, estCost: r.estCost, justification: r.justification,
      raisedBy: r.raisedBy, raisedAt: ist(r.raisedAt), expectedDelivery: r.expectedDelivery, revisionOf: null,
      advanceRequired: r.advance.required, advanceAmount: r.advance.amount, advanceTerms: r.advance.terms,
    })), { transaction });
    await RequisitionApproval.bulkCreate(fresh.flatMap((r) => r.approvals.map((a) => ({
      requisitionId: r.id, stage: a.stage, decision: a.decision, decidedBy: a.by, decidedAt: ist(a.at), note: a.note,
      onBehalfOf: a.onBehalfOf, lateDays: a.lateDays,
    }))), { transaction });
    await RequisitionPayment.bulkCreate(fresh.flatMap((r) => r.payments.map((p) => ({
      requisitionId: r.id, kind: p.kind, amount: p.amount, mode: p.mode, ref: p.ref, paidBy: p.by, paidAt: ist(p.at),
    }))), { transaction });

    const bought = SEED_REQUISITIONS.filter((r) => r.procurement);
    const recorded = new Set((await AssetProcurement.findAll({
      where: { reqRef: { [Op.in]: bought.map((r) => r.ref) } }, attributes: ["reqRef"], transaction,
    })).map((p) => p.reqRef));
    const purchases = bought.filter((r) => !recorded.has(r.ref)).map((r) => {
      const p = r.procurement!;
      const at = ist(p.at);
      return {
        reqRef: r.ref, dealershipId: r.dealershipId, vendor: p.vendor, invoiceNo: p.invoice,
        purchaseDate: p.at.slice(0, 10), total: p.actualCost, invoiceDoc: null, verified: true,
        recordedBy: p.by, recordedAt: at, verifiedBy: p.by, verifiedAt: at, verificationNote: "Entered and verified by the functional head.",
      };
    });
    await AssetProcurement.bulkCreate(purchases, { transaction });

    /* New references continue after the seeded ones */
    const byYear = new Map<number, number>();
    for (const r of SEED_REQUISITIONS) {
      const [, y, n] = r.ref.split("-");
      byYear.set(Number(y), Math.max(byYear.get(Number(y)) ?? 0, Number(n)));
    }
    for (const [year, last] of byYear) {
      const row = await RequisitionRefSequence.findByPk(year, { transaction });
      if (!row) await RequisitionRefSequence.create({ year, lastValue: last }, { transaction });
      else if (row.lastValue < last) await row.update({ lastValue: last }, { transaction });
    }

    const set = new Set((await Setting.findAll({ attributes: ["key"], transaction })).map((s) => s.key));
    const defaults = Object.entries(LIMIT_DEFAULTS).filter(([key]) => !set.has(key)).map(([key, value]) => ({ key, value, updatedBy: null }));
    await Setting.bulkCreate(defaults, { transaction });

    return { requisitions: fresh.length, purchases: purchases.length, settings: defaults.length };
  });
}
