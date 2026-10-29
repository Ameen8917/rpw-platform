import { Op, type Transaction } from "sequelize";
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
};

export type AuditRepository = typeof auditRepository;
