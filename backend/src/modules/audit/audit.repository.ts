import { Op, type Transaction, type WhereOptions } from "sequelize";
import { containsPattern } from "../../lib/like.js";
import { AuditEntry } from "./audit.models.js";

export interface NewAuditEntry {
  actorId: string;
  action: string;
  ref: string;
  detail: string;
}

/* Database access for the audit log. Only this file touches the AuditEntry model.
   record() takes the caller's transaction so an action and its entry commit together. */
export const auditRepository = {
  record: (entry: NewAuditEntry, transaction?: Transaction) => AuditEntry.create(entry, { transaction }),

  list: (opts: { refs?: string[]; limit: number }) =>
    AuditEntry.findAll({
      where: opts.refs ? { ref: { [Op.in]: opts.refs } } : {},
      order: [["at", "DESC"]],
      limit: opts.limit,
    }),

  /* One page, newest first, with the total that matches. The id breaks ties between entries
     written in the same instant, so pages never repeat or skip a row. */
  async page(opts: { refs?: string[]; q?: string; actorIds?: string[]; offset: number; limit: number }) {
    const conditions: WhereOptions<AuditEntry>[] = [];
    if (opts.refs) conditions.push({ ref: { [Op.in]: opts.refs } });
    if (opts.q) {
      const like = { [Op.iLike]: containsPattern(opts.q) };
      const byActor = opts.actorIds?.length ? [{ actorId: { [Op.in]: opts.actorIds } }] : [];
      conditions.push({ [Op.or]: [{ action: like }, { ref: like }, { detail: like }, ...byActor] });
    }
    const { rows, count } = await AuditEntry.findAndCountAll({
      where: { [Op.and]: conditions },
      order: [["at", "DESC"], ["id", "DESC"]],
      offset: opts.offset,
      limit: opts.limit,
    });
    return { rows, total: count };
  },
};

export type AuditRepository = typeof auditRepository;
