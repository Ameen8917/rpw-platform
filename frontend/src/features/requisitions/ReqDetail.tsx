import { useState } from "react";
import {
  ShieldCheck, Plus, UserCheck, Building2, MapPin, Calendar, FileText, AlertTriangle, CheckCircle2, XCircle, Hash, Truck, ChevronLeft, Package, Landmark, Layers,
} from "lucide-react";
import { Btn, Card, Empty, Row, SectionTitle } from "../../components/ui";
import { LIMITS } from "../../domain/config";
import { PAY_STATUS, advanceOutstanding, paidSoFar, payStatus } from "../../domain/payments";
import { escalation, needsDirectorPurchase, reqStatus, variance } from "../../domain/requisitions";
import { ApprovalBox, ReqBadge } from "./RequisitionBits";
import { DecisionModal, PayModal, ProcureModal, ResubmitModal } from "./modals";
import { cx, fmtDate, inrFull, inrShort } from "../../lib/format";
import { T } from "../../theme";

export function ReqDetail({ ctx, r, onDecide, onProcure, onPay, onFinance, onDirector, onAdvanceApprove, onAdvanceEscalate, onVariance, onResubmit, assets }: Record<string, any>) {
  /* TODO(requisitions): App passes onVerify (functional head verifies a manager's asset entry),
     but no UI calls it yet, so "awaiting_verification" has no action button. */
  const { user, perm, D, DEP, F, U, go } = ctx;
  const [modal, setModal] = useState(null);
  if (!r) return <Empty msg="Requisition not found." />;
  const st = reqStatus(r);
  const dealership = D(r.dealershipId);
  const isCorp = dealership.isCorporate;
  const fnHead = U(DEP(r.deptId).functionalHeadId);
  const bhLabel = isCorp ? "Director" : "Business Head";
  const bhPerson = isCorp ? U("U_ARJ") : U(dealership.headId);

  /* Derived state — declared before anything that reads it */
  const esc = escalation(r);
  const varc = variance(r);
  const advOut = advanceOutstanding(r);
  const pst = payStatus(r);
  const pay = r.payments || { advance: null, balance: null };
  const linked = r.procurement ? assets.filter((a) => r.procurement.assetCodes.includes(a.code)) : [];
  const dirPurchaseNeeded = needsDirectorPurchase(r, [bhPerson, fnHead]);

  const canBH = !r.bh.decision && st === "pending" && ((isCorp && user.role === "director") || (!isCorp && user.role === "business_head" && user.dealershipIds.includes(r.dealershipId))
    || (perm.isDirector && esc?.stage === "bh"));
  const canFN = !r.fn.decision && st === "pending" && ((user.role === "functional_head" && user.deptId === r.deptId)
    || (perm.isDirector && esc?.stage === "fn"));
  const canProcure = st === "approved" && perm.canProcure && user.deptId === r.deptId;
  const canVariance = perm.isDirector && pst === "variance_reapproval";
  const canResubmit = st === "rejected" && !r.resubmittedAs && (r.raisedBy === user.id || perm.canRaise);
  const canDirPurchase = perm.isDirector && st === "pending" && dirPurchaseNeeded
    && r.bh.decision === "approved" && r.fn.decision === "approved" && !r.directorPurchase?.decision;
  const forMyDealership = user.dealershipIds?.includes(r.dealershipId) || user.deptId === "DEP_ACC";
  const canApproveAdvance = perm.canApproveAdvance && forMyDealership && pst === "advance_approval";
  const canAdvFinance = perm.canFinanceSignoff && pst === "advance_finance";
  const canAdvDirector = perm.isDirector && pst === "advance_director";
  const advEscalated = r.advance?.required && r.advance.amount > LIMITS.advanceEscalation;
  const belowDirectorThreshold = r.procurement && r.procurement.actualCost < LIMITS.directorPayment;
  const canPayAdvance = perm.canExecutePayment && forMyDealership && pst === "advance_to_pay";
  const canPayBalance = perm.canExecutePayment && forMyDealership && pst === "balance_to_pay";
  const canFinanceSignoff = perm.canFinanceSignoff && pst === "finance_signoff";
  const canDirectorSignoff = perm.isDirector && pst === "director_signoff";
  const balanceDue = r.procurement ? r.procurement.actualCost - paidSoFar(r) : 0;

  return (
    <div className="space-y-4">
      <button onClick={() => go("reqs")} className="flex items-center gap-1 text-sm font-semibold" style={{ color: T.primary }}><ChevronLeft size={16} />Requisitions</button>

      {esc && (() => {
        const ownerId = esc.stage === "bh" ? (isCorp ? "U_ARJ" : dealership.headId) : DEP(r.deptId).functionalHeadId;
        const isMine = ownerId === user.id;
        return (
          <div className="rounded-lg px-3 py-2.5" style={{ background: T.badBg }}>
            <div className="flex items-center gap-2 text-xs font-bold" style={{ color: T.bad }}>
              <AlertTriangle size={14} />
              {isMine ? `Your approval is overdue — ${esc.days} days` : `Escalated to Director — no response in ${esc.days} days`}
            </div>
            <div className="mt-1 text-[12px]" style={{ color: T.ink }}>
              {isMine
                ? `Waiting with you since ${fmtDate(esc.stage === "bh" ? r.raisedAt : r.bh.at)}. Past the ${LIMITS.slaDays}-day window, so the Director can now approve in your place. You can still act on it yourself.`
                : `Pending with ${esc.stage === "bh" ? (isCorp ? "the Director" : `${bhPerson?.name} (Business Head)`) : `${fnHead?.name} (${DEP(r.deptId).name} Head)`} since ${fmtDate(esc.stage === "bh" ? r.raisedAt : r.bh.at)}. They can still act; the Director may approve in their place.`}
            </div>
          </div>
        );
      })()}

      {advOut && (
        <div className="rounded-lg px-3 py-2.5" style={{ background: T.badBg }}>
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: T.bad }}>
            <AlertTriangle size={14} />Advance outstanding — {inrFull(advOut.amount)}
          </div>
          <div className="mt-1 text-[12px]" style={{ color: T.ink }}>
            Paid to vendor, goods not yet received. Expected {fmtDate(r.expectedDelivery)} — {advOut.days} days overdue. Held in the books as an advance to vendor until receipt.
          </div>
        </div>
      )}

      {r.revisionOf && (
        <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: T.primarySoft, color: T.primaryDark }}>
          Revised resubmission of {r.revisionOf}.
        </div>
      )}
      {r.resubmittedAs && (
        <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: T.slateBg, color: T.sub }}>
          Rejected — resubmitted as {r.resubmittedAs}.
        </div>
      )}


      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold">{r.item}</h1><ReqBadge s={st} />
            </div>
            <div className="mt-1 font-mono text-[12px]" style={{ color: T.sub }}>{r.ref} · raised by {U(r.raisedBy).name} on {fmtDate(r.raisedAt)}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px]" style={{ color: T.sub }}>{r.procurement ? "Actual" : "Estimated"}</div>
            <div className="text-lg font-bold">{inrFull(r.procurement ? r.procurement.actualCost : r.estCost)}</div>
          </div>
        </div>
        {(canBH || canFN || canProcure || canDirPurchase) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {canBH && <><Btn size="sm" icon={CheckCircle2} onClick={() => setModal("bh_approve")}>Approve as {bhLabel}</Btn>
              <Btn size="sm" kind="danger" icon={XCircle} onClick={() => setModal("bh_reject")}>Reject</Btn></>}
            {canFN && <><Btn size="sm" icon={CheckCircle2} onClick={() => setModal("fn_approve")}>Approve as {DEP(r.deptId).name} Head</Btn>
              <Btn size="sm" kind="danger" icon={XCircle} onClick={() => setModal("fn_reject")}>Reject</Btn></>}
            {canDirPurchase && <><Btn size="sm" icon={CheckCircle2} onClick={() => setModal("dp_approve")}>Approve purchase {inrShort(r.estCost)}</Btn>
              <Btn size="sm" kind="danger" icon={XCircle} onClick={() => setModal("dp_reject")}>Reject</Btn></>}
            {canProcure && <Btn size="sm" icon={Package} onClick={() => setModal("procure")}>Record procurement</Btn>}
          </div>
        )}
        {canResubmit && (
          <div className="mt-4"><Btn size="sm" icon={Plus} onClick={() => setModal("resubmit")}>Revise & resubmit</Btn></div>
        )}
        {(canApproveAdvance || canAdvFinance || canAdvDirector || canPayAdvance || canPayBalance || canFinanceSignoff || canDirectorSignoff || canVariance) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {canApproveAdvance && <><Btn size="sm" icon={CheckCircle2} onClick={() => setModal("adv_approve")}>Approve advance {inrShort(r.advance.amount)}</Btn>
              <Btn size="sm" kind="danger" icon={XCircle} onClick={() => setModal("adv_hold")}>Hold</Btn></>}
            {canAdvFinance && <><Btn size="sm" icon={CheckCircle2} onClick={() => setModal("advfin_approve")}>Approve advance {inrShort(r.advance.amount)}</Btn>
              <Btn size="sm" kind="danger" icon={XCircle} onClick={() => setModal("advfin_hold")}>Hold</Btn></>}
            {canAdvDirector && <><Btn size="sm" icon={CheckCircle2} onClick={() => setModal("advdir_approve")}>Approve advance {inrShort(r.advance.amount)}</Btn>
              <Btn size="sm" kind="danger" icon={XCircle} onClick={() => setModal("advdir_hold")}>Hold</Btn></>}
            {canPayAdvance && <Btn size="sm" icon={Landmark} onClick={() => setModal("pay_advance")}>Pay advance {inrShort(r.advance.amount)}</Btn>}
            {canFinanceSignoff && <><Btn size="sm" icon={CheckCircle2} onClick={() => setModal("fin_approve")}>Payment sign-off {inrShort(balanceDue)}</Btn>
              <Btn size="sm" kind="danger" icon={XCircle} onClick={() => setModal("fin_hold")}>Hold</Btn></>}
            {canDirectorSignoff && <><Btn size="sm" icon={CheckCircle2} onClick={() => setModal("dir_approve")}>Approve payment {inrShort(balanceDue)}</Btn>
              <Btn size="sm" kind="danger" icon={XCircle} onClick={() => setModal("dir_hold")}>Hold</Btn></>}
            {canVariance && <><Btn size="sm" icon={CheckCircle2} onClick={() => setModal("var_approve")}>Approve overrun {inrShort(varc.over)}</Btn>
              <Btn size="sm" kind="danger" icon={XCircle} onClick={() => setModal("var_reject")}>Query</Btn></>}
            {canPayBalance && <Btn size="sm" icon={Landmark} onClick={() => setModal("pay_balance")}>Pay balance {inrShort(balanceDue)}</Btn>}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle icon={ShieldCheck}>Dual authority</SectionTitle>
        <p className="mt-1 text-[12px]" style={{ color: T.sub }}>
          {DEP(r.deptId).name} is a dual-authority function — both signatures required before procurement.
          {dirPurchaseNeeded && (r.estCost > LIMITS.purchaseDirector
            ? ` Estimate over ${inrShort(LIMITS.purchaseDirector)}, so Director approval is also required before buying.`
            : " Above an approver's personal limit, so Director approval is also required.")}
        </p>
        <div className={cx("mt-3 grid grid-cols-1 gap-3", dirPurchaseNeeded ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          <ApprovalBox label={bhLabel} person={bhPerson} slot={r.bh} U={U} />
          <ApprovalBox label={`${DEP(r.deptId).name} Head`} person={fnHead} slot={r.fn} U={U} />
          {dirPurchaseNeeded && <ApprovalBox label="Director" person={U("U_ARJ")} slot={r.directorPurchase || { decision: null }} U={U} />}
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle icon={Landmark}>Payment</SectionTitle>
          <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ color: PAY_STATUS[pst].c, background: PAY_STATUS[pst].bg }}>{PAY_STATUS[pst].label}</span>
        </div>
        {r.advance?.required ? (
          <div className="mt-3 rounded-lg p-3" style={{ background: pay.advance ? T.okBg : T.badBg }}>
            <div className="text-xs font-bold" style={{ color: pay.advance ? T.ok : T.bad }}>
              Vendor advance {pay.advance ? "paid" : "required"} — {inrFull(r.advance.amount)}
            </div>
            {r.advance.terms && <div className="mt-1 text-[12px]" style={{ color: T.ink }}>{r.advance.terms}</div>}
            <div className="mt-1 text-[11px]" style={{ color: T.sub }}>
              Accounts Manager: {r.advanceApproval?.decision === "approved" ? `approved by ${U(r.advanceApproval.by).name} · ${fmtDate(r.advanceApproval.at)}`
                : r.advanceApproval?.decision === "held" ? `held by ${U(r.advanceApproval.by).name}` : "pending"}
            </div>
            {advEscalated && (
              <div className="mt-1 text-[11px]" style={{ color: T.sub }}>
                Above {inrShort(LIMITS.advanceEscalation)} — GM Finance: {r.advanceFinance?.decision === "approved" ? `approved · ${fmtDate(r.advanceFinance.at)}` : r.advanceFinance?.decision === "held" ? "held" : "pending"}
                {" · "}Director: {r.advanceDirector?.decision === "approved" ? `approved · ${fmtDate(r.advanceDirector.at)}` : r.advanceDirector?.decision === "held" ? "held" : "pending"}
              </div>
            )}
            {pay.advance && <div className="mt-1 text-[11px]" style={{ color: T.sub }}>
              Paid by {U(pay.advance.by).name} · {fmtDate(pay.advance.at)} · {pay.advance.mode} · UTR <span className="font-mono">{pay.advance.ref}</span>
            </div>}
          </div>
        ) : (
          <p className="mt-2 text-[13px]" style={{ color: T.sub }}>No advance required — payment on delivery.</p>
        )}
        {r.procurement && ["finance_signoff", "director_signoff", "balance_to_pay", "settled"].includes(pst) && (
          <div className="mt-2 rounded-lg p-3" style={{ background: r.financeApproval?.decision === "approved" ? T.okBg : r.financeApproval?.decision === "held" ? T.badBg : T.slateBg }}>
            <div className="text-xs font-bold" style={{ color: r.financeApproval?.decision === "approved" ? T.ok : r.financeApproval?.decision === "held" ? T.bad : T.sub }}>
              Payment sign-off (GM Finance) — {r.financeApproval?.decision === "approved" ? "done" : r.financeApproval?.decision === "held" ? "withheld" : "pending"}
            </div>
            {!r.procurement.invoiceDoc && (
              <div className="mt-1 text-[11px] font-semibold" style={{ color: T.bad }}>No invoice attached to this purchase</div>
            )}
            <div className="mt-1 text-[12px]" style={{ color: T.ink }}>
              {r.financeApproval?.by ? U(r.financeApproval.by).name : "Sujay Kathar"}
              {r.financeApproval?.at ? ` · ${fmtDate(r.financeApproval.at)}` : " — third signature required before balance release"}
            </div>
            {r.financeApproval?.note && <div className="mt-1 text-[12px]" style={{ color: T.sub }}>“{r.financeApproval.note}”</div>}
          </div>
        )}
        {varc && (
          <div className="mt-3 rounded-lg p-3" style={{ background: r.varianceApproval?.decision === "approved" ? T.okBg : T.badBg }}>
            <div className="text-xs font-bold" style={{ color: r.varianceApproval?.decision === "approved" ? T.ok : T.bad }}>
              Cost overrun {varc.pct.toFixed(0)}% — {inrFull(varc.over)} over estimate
            </div>
            <div className="mt-1 text-[12px]" style={{ color: T.ink }}>
              Estimated {inrFull(r.estCost)}, invoiced {inrFull(r.procurement.actualCost)}. Overruns above {LIMITS.variancePct}% need Director re-approval before payment.
            </div>
            {r.varianceApproval?.decision && <div className="mt-1 text-[11px]" style={{ color: T.sub }}>
              {r.varianceApproval.decision === "approved" ? "Re-approved" : "Queried"} by {U(r.varianceApproval.by).name} · {fmtDate(r.varianceApproval.at)}
              {r.varianceApproval.note ? ` — ${r.varianceApproval.note}` : ""}
            </div>}
          </div>
        )}
        {r.procurement && belowDirectorThreshold && ["balance_to_pay", "settled"].includes(pst) && (
          <div className="mt-2 rounded-lg p-3" style={{ background: T.slateBg }}>
            <div className="text-xs font-bold" style={{ color: T.sub }}>Director approval not required</div>
            <div className="mt-1 text-[12px]" style={{ color: T.ink }}>Purchase under {inrShort(LIMITS.directorPayment)} — cleared for payment on GM Finance sign-off.</div>
          </div>
        )}
        {r.procurement && !belowDirectorThreshold && ["director_signoff", "balance_to_pay", "settled"].includes(pst) && (
          <div className="mt-2 rounded-lg p-3" style={{ background: r.directorApproval?.decision === "approved" ? T.okBg : r.directorApproval?.decision === "held" ? T.badBg : T.slateBg }}>
            <div className="text-xs font-bold" style={{ color: r.directorApproval?.decision === "approved" ? T.ok : r.directorApproval?.decision === "held" ? T.bad : T.sub }}>
              Director approval — {r.directorApproval?.decision === "approved" ? "approved" : r.directorApproval?.decision === "held" ? "held" : "pending"}
            </div>
            <div className="mt-1 text-[12px]" style={{ color: T.ink }}>
              {r.directorApproval?.by ? U(r.directorApproval.by).name : "Arjun"}
              {r.directorApproval?.at ? ` · ${fmtDate(r.directorApproval.at)}` : " — final signature before money moves"}
            </div>
            {r.directorApproval?.note && <div className="mt-1 text-[12px]" style={{ color: T.sub }}>“{r.directorApproval.note}”</div>}
          </div>
        )}
        {pay.balance && (
          <div className="mt-2 rounded-lg p-3" style={{ background: T.okBg }}>
            <div className="text-xs font-bold" style={{ color: T.ok }}>Balance paid — {inrFull(pay.balance.amount)}</div>
            <div className="mt-1 text-[11px]" style={{ color: T.sub }}>
              Paid by {U(pay.balance.by).name} · {fmtDate(pay.balance.at)} · {pay.balance.mode} · UTR <span className="font-mono">{pay.balance.ref}</span>
            </div>
          </div>
        )}
        {r.procurement && (
          <div className="mt-3 flex justify-between border-t pt-2 text-sm" style={{ borderColor: T.line }}>
            <span style={{ color: T.sub }}>Paid {inrFull(paidSoFar(r))} of {inrFull(r.procurement.actualCost)}</span>
            {balanceDue > 0 && <span className="font-bold" style={{ color: T.warn }}>{inrFull(balanceDue)} outstanding</span>}
          </div>
        )}
      </Card>

      <Card>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <Row icon={Building2} k="Dealership" v={`${dealership.name} (${dealership.code})`} />
          <Row icon={MapPin} k="Facility" v={r.facilityId ? `${F(r.facilityId).name} · ${F(r.facilityId).type}` : "—"} />
          <Row icon={Layers} k="Department" v={DEP(r.deptId).name} />
          <Row icon={Hash} k="Quantity" v={String(r.qty)} />
          <Row icon={Calendar} k="Raised on" v={fmtDate(r.raisedAt)} />
          <Row icon={Truck} k="Expected delivery" v={r.expectedDelivery ? fmtDate(r.expectedDelivery) : "—"} />
          <Row icon={FileText} k="Justification" v={r.justification} />
        </dl>
      </Card>

      {r.procurement && (
        <Card>
          <SectionTitle icon={Package}>Procurement</SectionTitle>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            <Row icon={UserCheck} k="Procured by" v={U(r.procurement.by).name} />
            <Row icon={Calendar} k="Date" v={fmtDate(r.procurement.at)} />
            <Row icon={Truck} k="Vendor" v={r.procurement.vendor} />
            <Row icon={FileText} k="Invoice" v={r.procurement.invoice} mono />
            <Row icon={Landmark} k="Actual cost" v={inrFull(r.procurement.actualCost)} />
          </dl>
          {r.procurement.invoiceDoc && (() => {
            const doc = r.procurement.invoiceDoc;
            const v = doc.total != null ? ((doc.total - r.estCost) / r.estCost) * 100 : null;
            return (
              <div className="mt-4 rounded-lg p-3" style={{ background: T.canvas }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold" style={{ color: T.sub }}>Purchase invoice</span>
                  <a href={doc.fileUrl} download={doc.fileName} className="text-[12px] font-semibold" style={{ color: T.primary }}>Download</a>
                </div>

                {doc.fileType?.startsWith("image") ? (
                  <a href={doc.fileUrl} target="_blank" rel="noreferrer">
                    <img src={doc.fileUrl} alt="Invoice" style={{ marginTop: 8, maxHeight: 220, width: "100%", objectFit: "contain", background: "#fff", border: "1px solid " + T.line, borderRadius: 6 }} />
                  </a>
                ) : (
                  <div className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "#fff", border: "1px solid " + T.line }}>
                    <FileText size={18} style={{ color: T.sub }} />
                    <span className="min-w-0 flex-1 truncate text-[12px]">{doc.fileName}</span>
                  </div>
                )}

                {doc.total != null && (
                  <>
                    <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                      <dt style={{ color: T.sub }}>Approved estimate</dt><dd className="text-right">{inrFull(r.estCost)}</dd>
                      <dt style={{ color: T.sub }}>Invoice total</dt><dd className="text-right font-semibold">{inrFull(doc.total)}</dd>
                      {doc.tax != null && <><dt style={{ color: T.sub }}>of which GST</dt><dd className="text-right">{inrFull(doc.tax)}</dd></>}
                      <dt style={{ color: T.sub }}>Recorded in register</dt><dd className="text-right">{inrFull(r.procurement.actualCost)}</dd>
                    </dl>
                    <div className="mt-2 rounded-lg px-3 py-2 text-[12px]"
                      style={Math.abs(v) <= LIMITS.variancePct ? { background: T.okBg, color: T.ok } : { background: T.badBg, color: T.bad }}>
                      {Math.abs(v) <= LIMITS.variancePct
                        ? `Reconciled — ${v >= 0 ? "+" : ""}${v.toFixed(1)}% against the approved estimate.`
                        : `${v > 0 ? "Over" : "Under"} the approved estimate by ${Math.abs(v).toFixed(1)}%.`}
                    </div>
                  </>
                )}
                <p className="mt-2 text-[11px]" style={{ color: T.sub }}>
                  Figures read from the document at upload. Visible to every approver on this requisition.
                </p>
              </div>
            );
          })()}

          <div className="mt-4">
            <div className="mb-2 text-xs font-bold" style={{ color: T.sub }}>Assets created ({linked.length})</div>
            <div className="space-y-2">
              {linked.map((a) => (
                <button key={a.id} onClick={() => go("assetdetail", a.id)} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left" style={{ background: T.canvas }}>
                  <div><div className="text-sm font-semibold">{a.name}</div><div className="font-mono text-[11px]" style={{ color: T.sub }}>{a.code}</div></div>
                  <span className="text-sm font-bold">{inrShort(a.cost)}</span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {modal?.startsWith("bh") && <DecisionModal title={`${modal.endsWith("approve") ? "Approve" : "Reject"} as ${bhLabel}`} decision={modal.endsWith("approve") ? "approved" : "rejected"}
        onClose={() => setModal(null)} onSubmit={(note) => { onDecide(r, "bh", modal.endsWith("approve") ? "approved" : "rejected", note); setModal(null); }} />}
      {modal?.startsWith("fn") && <DecisionModal title={`${modal.endsWith("approve") ? "Approve" : "Reject"} as ${DEP(r.deptId).name} Head`} decision={modal.endsWith("approve") ? "approved" : "rejected"}
        onClose={() => setModal(null)} onSubmit={(note) => { onDecide(r, "fn", modal.endsWith("approve") ? "approved" : "rejected", note); setModal(null); }} />}
      {modal === "var_approve" && <DecisionModal title="Approve cost overrun" decision="approved"
        onClose={() => setModal(null)} onSubmit={(note) => { onVariance(r, "approved", note); setModal(null); }} />}
      {modal === "var_reject" && <DecisionModal title="Query cost overrun" decision="rejected"
        onClose={() => setModal(null)} onSubmit={(note) => { onVariance(r, "queried", note); setModal(null); }} />}
      {modal === "resubmit" && <ResubmitModal r={r} ctx={ctx} onClose={() => setModal(null)}
        onSubmit={(draft) => { onResubmit(draft); setModal(null); }} />}
      {modal === "dp_approve" && <DecisionModal title="Approve purchase — Director" decision="approved"
        onClose={() => setModal(null)} onSubmit={(note) => { onDecide(r, "directorPurchase", "approved", note); setModal(null); }} />}
      {modal === "dp_reject" && <DecisionModal title="Reject purchase — Director" decision="rejected"
        onClose={() => setModal(null)} onSubmit={(note) => { onDecide(r, "directorPurchase", "rejected", note); setModal(null); }} />}
      {modal === "procure" && <ProcureModal r={r} ctx={ctx} onClose={() => setModal(null)} onSubmit={async (form) => { if (await onProcure(r, form)) setModal(null); }} />}
      {modal === "pay_advance" && <PayModal kind="advance" r={r} suggested={r.advance.amount} onClose={() => setModal(null)} onSubmit={(form) => { onPay(r, "advance", form); setModal(null); }} />}
      {modal === "pay_balance" && <PayModal kind="balance" r={r} suggested={balanceDue} onClose={() => setModal(null)} onSubmit={(form) => { onPay(r, "balance", form); setModal(null); }} />}
      {modal === "fin_approve" && <DecisionModal title="Payment sign-off" decision="approved"
        onClose={() => setModal(null)} onSubmit={(note) => { onFinance(r, "approved", note); setModal(null); }} />}
      {modal === "fin_hold" && <DecisionModal title="Withhold payment sign-off" decision="rejected"
        onClose={() => setModal(null)} onSubmit={(note) => { onFinance(r, "held", note); setModal(null); }} />}
      {modal === "dir_approve" && <DecisionModal title="Approve final payment" decision="approved"
        onClose={() => setModal(null)} onSubmit={(note) => { onDirector(r, "approved", note); setModal(null); }} />}
      {modal === "dir_hold" && <DecisionModal title="Hold final payment" decision="rejected"
        onClose={() => setModal(null)} onSubmit={(note) => { onDirector(r, "held", note); setModal(null); }} />}
      {modal === "adv_approve" && <DecisionModal title="Approve advance for payment" decision="approved"
        onClose={() => setModal(null)} onSubmit={(note) => { onAdvanceApprove(r, "approved", note); setModal(null); }} />}
      {modal === "adv_hold" && <DecisionModal title="Hold advance" decision="rejected"
        onClose={() => setModal(null)} onSubmit={(note) => { onAdvanceApprove(r, "held", note); setModal(null); }} />}
      {modal === "advfin_approve" && <DecisionModal title="Approve advance — GM Finance" decision="approved"
        onClose={() => setModal(null)} onSubmit={(note) => { onAdvanceEscalate(r, "advanceFinance", "approved", note); setModal(null); }} />}
      {modal === "advfin_hold" && <DecisionModal title="Hold advance — GM Finance" decision="rejected"
        onClose={() => setModal(null)} onSubmit={(note) => { onAdvanceEscalate(r, "advanceFinance", "held", note); setModal(null); }} />}
      {modal === "advdir_approve" && <DecisionModal title="Approve advance — Director" decision="approved"
        onClose={() => setModal(null)} onSubmit={(note) => { onAdvanceEscalate(r, "advanceDirector", "approved", note); setModal(null); }} />}
      {modal === "advdir_hold" && <DecisionModal title="Hold advance — Director" decision="rejected"
        onClose={() => setModal(null)} onSubmit={(note) => { onAdvanceEscalate(r, "advanceDirector", "held", note); setModal(null); }} />}
    </div>
  );
}
