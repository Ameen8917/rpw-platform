import { Op, QueryTypes, type CreationAttributes, type Transaction, type WhereOptions } from "sequelize";
import { Requisition, RequisitionApproval, RequisitionPayment, RequisitionRefSequence } from "./requisitions.models.js";

/** Which requisitions a query may return; the service narrows further where status matters */
export type RequisitionScope =
  | { all: true }
  | { all: false; dealershipIds?: string[]; deptId?: string; raisedBy: string };

/* Factories, not shared objects: Sequelize mutates include definitions while building a query */
const standard = () => [
  { model: RequisitionApproval, as: "approvals" },
  { model: RequisitionPayment, as: "payments" },
];

const quotedTable = (model: { getTableName(): string | object }) => {
  const t = model.getTableName() as unknown as { schema?: string; tableName: string } | string;
  return typeof t === "string" ? `"${t}"` : `"${t.schema}"."${t.tableName}"`;
};

function scoped(scope: RequisitionScope): WhereOptions<Requisition> {
  if (scope.all) return {};
  const any: WhereOptions<Requisition>[] = [{ raisedBy: scope.raisedBy }];
  if (scope.dealershipIds?.length) any.push({ dealershipId: { [Op.in]: scope.dealershipIds } });
  if (scope.deptId) any.push({ deptId: scope.deptId });
  return { [Op.or]: any };
}

/* Database access for requisitions. Only this file touches the requisition models. */
export const requisitionRepository = {
  transaction: <T>(work: (t: Transaction) => Promise<T>) => Requisition.sequelize!.transaction(work),

  list: (scope: RequisitionScope) =>
    Requisition.findAll({ where: scoped(scope), include: standard(), order: [["raisedAt", "DESC"], ["ref", "DESC"]] }),

  findById: (id: string, transaction?: Transaction) => Requisition.findByPk(id, { include: standard(), transaction }),

  findByRef: (ref: string, transaction?: Transaction) => Requisition.findOne({ where: { ref }, include: standard(), transaction }),

  /* Locks the requisition row until the transaction ends, so two decisions on one requisition
     run one after the other and each sees the other's result */
  lockById: (id: string, transaction: Transaction) => Requisition.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE }),

  create: (r: CreationAttributes<Requisition>, transaction: Transaction) => Requisition.create(r, { transaction }),

  update: (r: Requisition, fields: Partial<CreationAttributes<Requisition>>, transaction: Transaction) =>
    r.update(fields, { transaction }),

  /* One decision per stage. Money stages that were held may be decided again, so this replaces. */
  saveDecision: (a: CreationAttributes<RequisitionApproval>, transaction: Transaction) =>
    RequisitionApproval.upsert(a, { transaction }),

  /** Throws UniqueConstraintError if this payment was already recorded */
  addPayment: (p: CreationAttributes<RequisitionPayment>, transaction: Transaction) =>
    RequisitionPayment.create(p, { transaction }),

  /* Takes the next number for a year, as nextCodeNumber does for asset codes: the row lock
     holds until the caller's transaction ends */
  async nextRefNumber(year: number, transaction: Transaction): Promise<number> {
    const table = quotedTable(RequisitionRefSequence);
    const [row] = await Requisition.sequelize!.query<{ last_value: number }>(
      `INSERT INTO ${table} (year, last_value, updated_at) VALUES ($1, 1, now())
       ON CONFLICT (year) DO UPDATE SET last_value = ${table}.last_value + 1, updated_at = now()
       RETURNING last_value`,
      { bind: [year], type: QueryTypes.SELECT, transaction },
    );
    return row.last_value;
  },
};

export type RequisitionRepository = typeof requisitionRepository;
