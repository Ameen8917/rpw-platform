import { UniqueConstraintError, type Transaction } from "sequelize";
import { HttpError } from "../../lib/http-error.js";
import { inrFull, todayIST } from "../assets/asset-rules.js";
import { assetRepository, type AssetRepository } from "../assets/assets.repository.js";
import type { AssetService } from "../assets/assets.service.js";
import { auditRepository, type AuditRepository } from "../audit/audit.repository.js";
import type { AuthContext } from "../auth/auth.service.js";
import type { Department, Dealership, User } from "../org/org.models.js";
import { orgRepository, type OrgRepository } from "../org/org.repository.js";
import type { Limits } from "../settings/settings.schemas.js";
import type { SettingsService } from "../settings/settings.service.js";
import {
  balanceDue, escalation, needsDirectorPurchase, payStatus, reqStatus, variance, type PayStatus, type ReqStatus,
} from "./requisition-rules.js";
import { toRequisitionDto, type PurchaseRecord, type RequisitionDto } from "./requisitions.dto.js";
import type { Decision, PaymentKind, Requisition, Stage } from "./requisitions.models.js";
import { requisitionRepository, type RequisitionRepository, type RequisitionScope } from "./requisitions.repository.js";
import {
  STAGE_DECISIONS, type DecisionInput, type PaymentInput, type ProcureInput, type RaiseInput, type ResubmitInput, type VerifyInput,
} from "./requisitions.schemas.js";

export interface RequisitionServiceOptions {
  assets: Pick<AssetService, "createProcured">;
  settings: Pick<SettingsService, "limits">;
  repo?: RequisitionRepository;
  assetRepo?: AssetRepository;
  orgRepo?: OrgRepository;
  auditRepo?: AuditRepository;
  now?: () => Date;
}

/* A 400 in the same shape the validate middleware produces, for checks that need the database */
const invalidField = (path: string, message: string) =>
  HttpError.badRequest("Request is invalid", [{ location: "body", path, message }]);

const notFound = () => HttpError.notFound("Requisition not found");
const notWaiting = () => HttpError.conflict("This requisition is not waiting for that decision");

/* The organisation as the rules need it: who heads what, and personal approval limits */
interface Org {
  dealerships: Map<string, Dealership>;
  departments: Map<string, Department>;
  users: Map<string, User>;
}

/* Everything a check needs about one requisition */
interface Loaded {
  row: Requisition;
  r: RequisitionDto;
  st: ReqStatus;
  pst: PayStatus;
  org: Org;
  limits: Limits;
  dealership: Dealership;
}

const name = (org: Org, id: string | null | undefined) => (id && org.users.get(id)?.name) || "unassigned";

export function createRequisitionService(opts: RequisitionServiceOptions) {
  const repo = opts.repo ?? requisitionRepository;
  const assetRepo = opts.assetRepo ?? assetRepository;
  const orgRepo = opts.orgRepo ?? orgRepository;
  const auditRepo = opts.auditRepo ?? auditRepository;
  const now = opts.now ?? (() => new Date());

  async function loadOrg(): Promise<Org> {
    const [dealerships, departments, users] = await Promise.all([orgRepo.listDealerships(), orgRepo.listDepartments(), orgRepo.listUsers()]);
    return {
      dealerships: new Map(dealerships.map((d) => [d.id, d])),
      departments: new Map(departments.map((d) => [d.id, d])),
      users: new Map(users.map((u) => [u.id, u])),
    };
  }

  /* Owner of the Business Head stage (the Director for Corporate, who heads it) and of the functional stage */
  const bhOwner = (org: Org, r: { dealershipId: string }) => org.dealerships.get(r.dealershipId)?.headId ?? null;
  const fnOwner = (org: Org, r: { deptId: string }) => org.departments.get(r.deptId)?.functionalHeadId ?? null;

  async function purchases(refs: string[], t?: Transaction) {
    const out = new Map<string, PurchaseRecord>();
    if (!refs.length) return out;
    const [rows, codes] = await Promise.all([assetRepo.purchasesFor(refs, t), assetRepo.codesFor(refs, t)]);
    for (const p of rows) {
      out.set(p.reqRef, {
        recordedBy: p.recordedBy, recordedAt: p.recordedAt, total: Number(p.total), vendor: p.vendor,
        invoiceNo: p.invoiceNo, invoiceDoc: p.invoiceDoc, verified: p.verified,
        verifiedBy: p.verifiedBy ?? null, verifiedAt: p.verifiedAt ?? null, verificationNote: p.verificationNote ?? null,
        assetCodes: codes.filter((a) => a.reqRef === p.reqRef).map((a) => a.code),
      });
    }
    return out;
  }

  function toDto(row: Requisition, purchase: PurchaseRecord | null, org: Org, limits: Limits) {
    const limitOf = (id: string | null) => {
      const l = id ? org.users.get(id)?.approvalLimit : null;
      return l === null || l === undefined ? null : Number(l);
    };
    const required = needsDirectorPurchase({ estCost: Number(row.estCost) }, {
      isCorporate: !!org.dealerships.get(row.dealershipId)?.isCorporate,
      limits,
      approverLimits: [limitOf(bhOwner(org, row)), limitOf(fnOwner(org, row))],
    });
    return toRequisitionDto(row, purchase, required);
  }

  /* Who sees which requisitions (docs/requisitions.md, section 4) */
  const seesAll = ({ user, permissions: p }: AuthContext) => p.isDirector || (p.isFnHead && user.deptId === "DEP_ACC");

  function dbScope(auth: AuthContext): RequisitionScope {
    const { user, permissions: p } = auth;
    if (seesAll(auth)) return { all: true };
    if (p.isFnHead && user.deptId) return { all: false, deptId: user.deptId, raisedBy: user.id };
    if (p.isBH || p.isAccounts || p.isExecutive) return { all: false, dealershipIds: user.dealershipIds, raisedBy: user.id };
    return { all: false, raisedBy: user.id };
  }

  function canSee(auth: AuthContext, r: RequisitionDto) {
    const { user, permissions: p } = auth;
    if (seesAll(auth) || r.raisedBy === user.id) return true;
    if (p.isFnHead) return r.deptId === user.deptId;
    if (p.isBH) return user.dealershipIds.includes(r.dealershipId);
    /* Accounts: their dealerships, once the requisition is out of approval */
    if (p.isAccounts || p.isExecutive) return user.dealershipIds.includes(r.dealershipId) && reqStatus(r) !== "pending";
    return false;
  }

  /* One requisition as `auth` may see it; with a transaction, its row is locked first */
  async function load(auth: AuthContext, id: string, t?: Transaction): Promise<Loaded> {
    if (t && !(await repo.lockById(id, t))) throw notFound();
    const row = await repo.findById(id, t);
    if (!row) throw notFound();
    const [org, limits, bought] = await Promise.all([loadOrg(), opts.settings.limits(), purchases([row.ref], t)]);
    const r = toDto(row, bought.get(row.ref) ?? null, org, limits);
    if (!canSee(auth, r)) throw notFound();
    return { row, r, st: reqStatus(r), pst: payStatus(r, limits), org, limits, dealership: org.dealerships.get(r.dealershipId)! };
  }

  /* REQ-<year>-<NNNN>, skipping numbers a purchase or asset already carries (R1) */
  async function nextRef(t: Transaction) {
    const year = Number(todayIST(now()).slice(0, 4));
    for (let i = 0; i < 1000; i++) {
      const ref = `REQ-${year}-${String(await repo.nextRefNumber(year, t)).padStart(4, "0")}`;
      if (!(await repo.findByRef(ref, t)) && !(await assetRepo.refInUse(ref, t))) return ref;
    }
    throw new Error("No free requisition reference");
  }

  /* Where a person may raise: managers at their dealerships, functional heads anywhere active */
  async function placement(auth: AuthContext, input: { dealershipId: string; facilityId: string | null; deptId: string }) {
    const dealership = await orgRepo.findDealershipById(input.dealershipId);
    if (!dealership?.active) throw invalidField("dealershipId", "No active dealership with this ID");
    if (!auth.permissions.isFnHead && !auth.user.dealershipIds.includes(dealership.id)) {
      throw HttpError.forbidden("You cannot raise requisitions for this dealership");
    }
    if (input.facilityId) {
      const f = await orgRepo.findFacilityById(input.facilityId);
      if (!f?.active || f.dealershipId !== dealership.id) throw invalidField("facilityId", "Not an active location of this dealership");
    }
    const dept = await orgRepo.findDepartmentById(input.deptId);
    if (!dept?.active || !dept.dualAuthority) throw invalidField("deptId", "Requisitions are raised for an active dual-authority department");
    return dealership;
  }

  /* -------- who may decide each stage, and is it waiting for that decision -------- */

  interface StageCheck { ready: boolean; may: boolean; why?: string; onBehalfOf?: string; lateDays?: number }

  function checkStage(auth: AuthContext, stage: Stage, x: Loaded): StageCheck {
    const { user, permissions: p } = auth;
    const { r, st, pst, dealership } = x;
    const mine = user.dealershipIds.includes(r.dealershipId);
    const esc = escalation(r, x.limits, now());
    /* After the SLA the Director may decide in the silent approver's place */
    const stepIn = (s: "bh" | "fn", owner: string | null): Partial<StageCheck> =>
      p.isDirector && esc?.stage === s && owner !== user.id ? { may: true, onBehalfOf: owner ?? undefined, lateDays: esc.days } : {};

    switch (stage) {
      case "bh": {
        const own = dealership.isCorporate ? p.isDirector : p.isBH && mine;
        return {
          ready: st === "pending" && !r.bh.decision,
          may: own,
          why: `Only the Business Head decides this until it is ${x.limits.slaDays} days overdue`,
          ...(own ? {} : stepIn("bh", bhOwner(x.org, r))),
        };
      }
      case "fn": {
        const own = p.isFnHead && user.deptId === r.deptId;
        return {
          ready: st === "pending" && !r.fn.decision,
          may: own,
          why: `Only the functional head decides this until it is ${x.limits.slaDays} days overdue`,
          ...(own ? {} : stepIn("fn", fnOwner(x.org, r))),
        };
      }
      case "directorPurchase":
        return {
          ready: st === "pending" && r.directorPurchaseRequired && r.bh.decision === "approved" && r.fn.decision === "approved" && !r.directorPurchase?.decision,
          may: p.isDirector,
        };
      case "advanceApproval": return { ready: pst === "advance_approval", may: p.canApproveAdvance && mine };
      case "advanceFinance": return { ready: pst === "advance_finance", may: p.canFinanceSignoff };
      case "advanceDirector": return { ready: pst === "advance_director", may: p.isDirector };
      case "varianceApproval": return { ready: pst === "variance_reapproval", may: p.isDirector };
      case "financeApproval": return { ready: pst === "finance_signoff", may: p.canFinanceSignoff };
      case "directorApproval": return { ready: pst === "director_signoff", may: p.isDirector };
    }
  }

  /* Audit wording, as in the prototype */
  function decisionEntry(stage: Stage, decision: Decision, note: string, x: Loaded, check: StageCheck) {
    const { r, dealership, org, limits } = x;
    const verb = decision === "approved" ? "Approved" : decision === "rejected" ? "Rejected" : decision === "queried" ? "Queried" : "Held";
    const tail = note ? ` — ${note}` : "";
    if (stage === "bh" || stage === "fn" || stage === "directorPurchase") {
      const who = stage === "bh" ? "business head" : stage === "directorPurchase" ? "Director, purchase" : "functional";
      const covered = check.onBehalfOf ? ` — Director acted in place of ${name(org, check.onBehalfOf)} after ${check.lateDays} days` : "";
      return { action: `${verb} requisition (${who})`, detail: `${dealership.name} · ${r.item}${covered}${tail}` };
    }
    if (stage === "advanceApproval") {
      return {
        action: decision === "approved" ? "Approved advance for payment" : "Held advance",
        detail: `${dealership.name} · ${inrFull(r.advance.amount)} advance${tail}`,
      };
    }
    const [label, amount] = {
      advanceFinance: ["advance (GM Finance)", r.advance.amount],
      advanceDirector: ["advance (Director)", r.advance.amount],
      varianceApproval: [`cost overrun of ${(variance(r, limits)?.pct ?? 0).toFixed(0)}% (Director)`, r.procurement?.actualCost ?? 0],
      financeApproval: ["payment sign-off (GM Finance)", balanceDue(r)],
      directorApproval: ["final payment (Director)", balanceDue(r)],
    }[stage] as [string, number];
    return { action: `${verb} ${label}`, detail: `${dealership.name} · ${inrFull(amount)}${tail}` };
  }

  async function get(auth: AuthContext, id: string) {
    return (await load(auth, id)).r;
  }

  return {
    async list(auth: AuthContext): Promise<RequisitionDto[]> {
      const rows = await repo.list(dbScope(auth));
      const [org, limits, bought] = await Promise.all([loadOrg(), opts.settings.limits(), purchases(rows.map((r) => r.ref))]);
      return rows.map((row) => toDto(row, bought.get(row.ref) ?? null, org, limits)).filter((r) => canSee(auth, r));
    },

    get,

    async raise(auth: AuthContext, input: RaiseInput) {
      if (!auth.permissions.canRaise) throw HttpError.forbidden();
      const dealership = await placement(auth, input);
      const id = await repo.transaction(async (t) => {
        const ref = await nextRef(t);
        const created = await repo.create({
          ref, dealershipId: dealership.id, facilityId: input.facilityId, deptId: input.deptId,
          item: input.item, qty: input.qty, estCost: input.estCost, justification: input.justification,
          raisedBy: auth.user.id, raisedAt: now(), expectedDelivery: input.expectedDelivery, revisionOf: null,
          advanceRequired: input.advance.required, advanceAmount: input.advance.required ? input.advance.amount : 0,
          advanceTerms: input.advance.required ? input.advance.terms : "",
        }, t);
        await auditRepo.record({
          actorId: auth.user.id, action: "Raised requisition", ref,
          detail: `${dealership.name} · ${input.item} · est. ${inrFull(input.estCost)}`,
        }, t);
        return created.id;
      });
      return get(auth, id);
    },

    /* Approve, reject, hold or query one stage */
    async decide(auth: AuthContext, id: string, stage: Stage, input: DecisionInput) {
      const allowed = STAGE_DECISIONS[stage] as readonly string[];
      if (!allowed.includes(input.decision)) throw invalidField("decision", `This stage takes ${allowed.join(" or ")}`);
      await repo.transaction(async (t) => {
        const x = await load(auth, id, t);
        const check = checkStage(auth, stage, x);
        if (!check.may) throw HttpError.forbidden(check.ready && check.why ? check.why : undefined);
        if (!check.ready) throw notWaiting();
        await repo.saveDecision({
          requisitionId: id, stage, decision: input.decision, decidedBy: auth.user.id, decidedAt: now(), note: input.note,
          onBehalfOf: check.onBehalfOf ?? null, lateDays: check.onBehalfOf ? check.lateDays ?? null : null,
        }, t);
        await auditRepo.record({ actorId: auth.user.id, ref: x.r.ref, ...decisionEntry(stage, input.decision, input.note, x, check) }, t);
      });
      return get(auth, id);
    },

    /* A rejected requisition, revised: approvals start again on a new reference */
    async resubmit(auth: AuthContext, id: string, input: ResubmitInput) {
      const newId = await repo.transaction(async (t) => {
        const x = await load(auth, id, t);
        const { r, row } = x;
        const raiser = r.raisedBy === auth.user.id;
        if (!raiser && !auth.permissions.canRaise) throw HttpError.forbidden();
        if (x.st !== "rejected" || r.resubmittedAs) throw HttpError.conflict("Only a rejected requisition can be resubmitted, once");
        if (!raiser) await placement(auth, r);
        if (r.advance.required && r.advance.amount > input.estCost) {
          throw invalidField("estCost", `The revised estimate is below the advance of ${inrFull(r.advance.amount)}`);
        }
        const ref = await nextRef(t);
        const created = await repo.create({
          ref, dealershipId: r.dealershipId, facilityId: r.facilityId, deptId: r.deptId,
          item: input.item, qty: input.qty, estCost: input.estCost, justification: input.justification,
          raisedBy: auth.user.id, raisedAt: now(), expectedDelivery: input.expectedDelivery, revisionOf: r.ref,
          advanceRequired: r.advance.required, advanceAmount: r.advance.amount, advanceTerms: r.advance.terms,
        }, t);
        await repo.update(row, { resubmittedAs: ref }, t);
        await auditRepo.record({
          actorId: auth.user.id, action: "Resubmitted requisition", ref,
          detail: `Revision of ${r.ref} · ${input.item} · est. ${inrFull(input.estCost)}`,
        }, t);
        return created.id;
      });
      return get(auth, newId);
    },

    /* The purchase: one asset per line, placed where the requisition is (R2) */
    async procure(auth: AuthContext, id: string, input: ProcureInput) {
      const { user, permissions: p } = auth;
      const { r, st } = await load(auth, id);
      if (!(p.canProcure && user.deptId === r.deptId && (p.isFnHead || user.dealershipIds.includes(r.dealershipId)))) {
        throw HttpError.forbidden("You cannot record purchases for this requisition");
      }
      if (st === "procured") throw HttpError.conflict("The purchase for this requisition has already been recorded");
      if (st !== "approved") throw HttpError.conflict("Only an approved requisition can be procured");
      const result = await opts.assets.createProcured(auth, {
        ...input, reqRef: r.ref, dealershipId: r.dealershipId, facilityId: r.facilityId, deptId: r.deptId,
      });
      return { requisition: await get(auth, id), assets: result.assets };
    },

    /* The functional head checks a manager's entry against the invoice: verify, or send it back (R3) */
    async verify(auth: AuthContext, id: string, input: VerifyInput) {
      await repo.transaction(async (t) => {
        const x = await load(auth, id, t);
        const { r } = x;
        if (!(auth.permissions.canVerifyEntry && auth.user.deptId === r.deptId)) throw HttpError.forbidden();
        if (!r.procurement || r.procurement.verification) throw HttpError.conflict("There is no asset entry waiting for verification");
        const at = now();
        if (input.decision === "verified") {
          await assetRepo.verifyPurchase(r.ref, { verifiedBy: auth.user.id, verifiedAt: at, verificationNote: input.note }, t);
          await auditRepo.record({
            actorId: auth.user.id, action: "Verified asset entry", ref: r.ref,
            detail: `${r.procurement.assetCodes.length} asset(s) · ${inrFull(r.procurement.actualCost)} confirmed against invoice${input.note ? ` — ${input.note}` : ""}`,
          }, t);
          return;
        }
        /* Only provisional assets may go: anything handed over, returned or disposed stays */
        const assets = await assetRepo.procuredAssets(r.ref, t);
        const inUse = assets.filter((a) => a.disposal || (a.custodyHistory ?? []).some((e) => !(e.kind === "issue" && e.method === null)));
        if (inUse.length) {
          throw HttpError.conflict(`Cannot send back: ${inUse.map((a) => a.code).join(", ")} already issued, returned or disposed`);
        }
        await assetRepo.removePurchase(r.ref, t);
        await repo.update(x.row, { sentBackBy: auth.user.id, sentBackAt: at, sentBackNote: input.note }, t);
        await auditRepo.record({
          actorId: auth.user.id, action: "Sent asset entry back", ref: r.ref,
          detail: `${input.note} · removed ${assets.map((a) => a.code).join(", ")}`,
        }, t);
      });
      return get(auth, id);
    },

    /* The Accounts Executive records a transfer once it is made */
    async pay(auth: AuthContext, id: string, kind: PaymentKind, input: PaymentInput) {
      await repo.transaction(async (t) => {
        const x = await load(auth, id, t);
        const { r, pst, dealership } = x;
        if (!(auth.permissions.canExecutePayment && auth.user.dealershipIds.includes(r.dealershipId))) throw HttpError.forbidden();
        if (pst !== (kind === "advance" ? "advance_to_pay" : "balance_to_pay")) throw HttpError.conflict(`This requisition has no ${kind} approved for payment`);
        const cap = kind === "advance" ? r.advance.amount : balanceDue(r);
        if (input.amount > cap) {
          throw invalidField("amount", kind === "advance" ? `At most the approved advance of ${inrFull(cap)}` : `At most the ${inrFull(cap)} outstanding`);
        }
        try {
          await repo.addPayment({ requisitionId: id, kind, amount: input.amount, mode: input.mode, ref: input.ref, paidBy: auth.user.id, paidAt: now() }, t);
        } catch (err) {
          if (err instanceof UniqueConstraintError) throw HttpError.conflict(`The ${kind} has already been paid`);
          throw err;
        }
        await auditRepo.record({
          actorId: auth.user.id, action: kind === "advance" ? "Paid vendor advance" : "Paid balance", ref: r.ref,
          detail: `${inrFull(input.amount)} · ${input.mode} · ${input.ref} · ${dealership.name}`,
        }, t);
      });
      return get(auth, id);
    },
  };
}

export type RequisitionService = ReturnType<typeof createRequisitionService>;
