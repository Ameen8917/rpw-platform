import { useState } from "react";
import {
  ShieldCheck, ChevronRight, AlertTriangle, CheckCircle2, Clock, Landmark,
} from "lucide-react";
import { Card, Empty, PageHead, Stat, Td, Th } from "../../components/ui";
import { LIMITS } from "../../domain/config";
import { PAY_STATUS, TO_PAY, dueAmount, needsPaymentAction, payStatus } from "../../domain/payments";
import { inrFull, inrShort } from "../../lib/format";
import { T } from "../../theme";

export function Payments({ ctx, reqs }) {
  const { user, perm, D, DEP, U, go } = ctx;
  const [tab, setTab] = useState("mine");
  const payable = reqs.filter((r) => !["not_ready", "closed"].includes(payStatus(r)));
  const mine = payable.filter((r) => needsPaymentAction(r, user, perm));
  const ADV_STAGES = ["advance_approval", "advance_finance", "advance_director"];
  const tabs = [["mine", "Awaiting me"], ["advance", "Advance approval"], ["final", "Final approval"], ["to_pay", "To pay"], ["settled", "Settled"], ["all", "All"]];
  const rows = tab === "all" ? payable
    : tab === "mine" ? mine
    : tab === "advance" ? payable.filter((r) => ADV_STAGES.includes(payStatus(r)))
    : tab === "final" ? payable.filter((r) => ["finance_signoff", "director_signoff"].includes(payStatus(r)))
    : tab === "to_pay" ? payable.filter((r) => TO_PAY.includes(payStatus(r)))
    : payable.filter((r) => payStatus(r) === tab);

  const advanceDue = payable.filter((r) => ADV_STAGES.includes(payStatus(r)));
  const toPay = payable.filter((r) => TO_PAY.includes(payStatus(r)));
  const signoff = payable.filter((r) => payStatus(r) === "finance_signoff");
  const dirSignoff = payable.filter((r) => payStatus(r) === "director_signoff");
  const advanceTotal = advanceDue.reduce((s, r) => s + r.advance.amount, 0);
  const toPayTotal = toPay.reduce((s, r) => s + dueAmount(r), 0);
  const mineTotal = mine.reduce((s, r) => s + dueAmount(r), 0);

  return (
    <div className="space-y-4">
      <PageHead title="Payments"
        sub={perm.canExecutePayment ? `Approved payments to execute — ${D(user.dealershipIds[0]).name}`
          : perm.isDirector ? "Final payment approval — group-wide"
          : perm.canFinanceSignoff ? "Payment sign-off — all dealerships"
          : D(user.dealershipIds[0]).name} />

      <div className="rounded-lg px-3 py-2.5 text-[12px]" style={{ background: T.canvas, color: T.sub }}>
        Thresholds — advances above {inrShort(LIMITS.advanceEscalation)} also need GM Finance and Director approval · purchases under {inrShort(LIMITS.directorPayment)} skip Director approval.
      </div>

      {perm.canExecutePayment ? (
        <>
          <div className="rounded-lg px-3 py-2.5 text-[12px]" style={{ background: T.primarySoft, color: T.primaryDark }}>
            These are fully approved. Make the transfer, then record the UTR or cheque number against each one.
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Ready to pay" value={String(toPay.length)} icon={Landmark} tone={toPay.length ? "warn" : undefined} />
            <Stat label="Amount to transfer" value={inrShort(toPayTotal)} icon={Landmark} accent />
            <Stat label="In approval" value={String(advanceDue.length + signoff.length + dirSignoff.length)} icon={Clock} />
            <Stat label="Paid & settled" value={String(payable.filter((r) => payStatus(r) === "settled").length)} icon={CheckCircle2} />
          </div>
        </>
      ) : perm.isDirector ? (
        <>
          <div className="rounded-lg px-3 py-2.5 text-[12px]" style={{ background: T.primarySoft, color: T.primaryDark }}>
            Purchases over {inrShort(LIMITS.purchaseDirector)} are approved by you before buying. This queue is the final release check after GM Finance sign-off — your view of money actually going out.
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Awaiting your approval" value={String(mine.length)} icon={ShieldCheck} tone={mine.length ? "warn" : undefined} />
            <Stat label="Value held" value={inrShort(mineTotal)} icon={Landmark} accent />
            <Stat label="At payment sign-off" value={String(signoff.length)} icon={Clock} />
            <Stat label="Approved, with accounts" value={inrShort(toPayTotal)} icon={Landmark} />
          </div>
        </>
      ) : perm.canFinanceSignoff ? (
        <>
          <div className="rounded-lg px-3 py-2.5 text-[12px]" style={{ background: T.primarySoft, color: T.primaryDark }}>
            Your payment sign-off is required on final payments only. Vendor advances are released by the dealership accounts managers.
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Awaiting your sign-off" value={String(mine.length)} icon={ShieldCheck} tone={mine.length ? "warn" : undefined} />
            <Stat label="Value held" value={inrShort(mineTotal)} icon={Landmark} accent />
            <Stat label="Cleared, with accounts" value={String(toPay.length)} icon={Clock} />
            <Stat label="Settled this year" value={String(payable.filter((r) => payStatus(r) === "settled").length)} icon={CheckCircle2} />
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Advances to approve" value={String(advanceDue.length)} icon={AlertTriangle} tone={advanceDue.length ? "bad" : undefined} />
          <Stat label="Advance value" value={inrShort(advanceTotal)} icon={Landmark} accent />
          <Stat label="With accounts to pay" value={String(toPay.length)} icon={Landmark} />
          <Stat label="In approval upstream" value={String(signoff.length + dirSignoff.length)} icon={ShieldCheck} />
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-lg p-1" style={{ background: T.surface, border: "1px solid " + T.line }}>
        {tabs.map(([k, l]) => {
          const n = k === "all" ? payable.length : payable.filter((r) => payStatus(r) === k).length;
          return <button key={k} onClick={() => setTab(k)} className="flex-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold"
            style={tab === k ? { background: T.primarySoft, color: T.primary } : { color: T.sub }}>{l} <span className="opacity-60">({n})</span></button>;
        })}
      </div>

      {rows.length === 0 ? <Card><Empty msg="Nothing awaiting payment here." /></Card> : (
        <>
          <div className="space-y-2 md:hidden">
            {rows.map((r) => {
              const p = payStatus(r);
              const due = dueAmount(r);
              return (
                <button key={r.id} onClick={() => go("reqdetail", r.id)} className="w-full text-left"><Card>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{r.item}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 text-[11px]" style={{ color: T.sub }}>
                        <span className="font-mono">{r.ref}</span><span>{D(r.dealershipId).name}</span>
                      </div>
                      <div className="mt-2"><span className="whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium" style={{ color: PAY_STATUS[p].c, background: PAY_STATUS[p].bg }}>{PAY_STATUS[p].label}</span></div>
                    </div>
                    {due > 0 && <div className="shrink-0 text-right">
                      <div className="text-[10px]" style={{ color: T.sub }}>Amount</div>
                      <div className="text-sm font-semibold">{inrShort(due)}</div>
                    </div>}
                  </div>
                </Card></button>
              );
            })}
          </div>

          <Card pad={false} className="hidden overflow-hidden md:block">
            <table className="w-full border-collapse text-sm">
              <thead><tr style={{ background: T.canvas, color: T.sub }}>
                <Th>Ref / item</Th><Th>Dealership</Th><Th>Dept</Th><Th>Approved by</Th><Th>Payment stage</Th><Th right>Amount</Th><Th right />
              </tr></thead>
              <tbody>
                {rows.map((r, i) => {
                  const p = payStatus(r);
                  const due = dueAmount(r);
                  return (
                    <tr key={r.id} onClick={() => go("reqdetail", r.id)} className="cursor-pointer hover:bg-slate-50" style={{ borderTop: i ? "1px solid " + T.line : "none" }}>
                      <Td><div className="font-semibold">{r.item}</div><div className="font-mono text-[11px]" style={{ color: T.sub }}>{r.ref}</div></Td>
                      <Td sub>{D(r.dealershipId).name}</Td>
                      <Td sub>{DEP(r.deptId).name}</Td>
                      <Td sub>{[r.bh.by && U(r.bh.by).name.split(" ")[0], r.fn.by && U(r.fn.by).name.split(" ")[0]].filter(Boolean).join(" + ")}</Td>
                      <Td><span className="whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium" style={{ color: PAY_STATUS[p].c, background: PAY_STATUS[p].bg }}>{PAY_STATUS[p].label}</span></Td>
                      <Td right>{due > 0 ? <span className="font-semibold">{inrFull(due)}</span> : <span style={{ color: T.sub }}>—</span>}</Td>
                      <Td right><ChevronRight size={16} style={{ color: T.sub, display: "inline" }} /></Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
