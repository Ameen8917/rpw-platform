import {
  Boxes, ShieldCheck, UserCheck, FileText, AlertTriangle, Clock, TrendingUp, Package, Landmark,
} from "lucide-react";
import { Btn, Card, MiniStat, PageHead, SectionTitle, Stat } from "../../components/ui";
import { depreciation } from "../../domain/assets";
import { LIMITS } from "../../domain/config";
import { TO_PAY, dueAmount, needsPaymentAction, payStatus } from "../../domain/payments";
import { REQ_STATUS, escalation, escalationRecords, needsMyAction, reqStatus, stageApprover } from "../../domain/requisitions";
import { TODAY, fmtDate, inrFull, inrShort, monthKey } from "../../lib/format";
import { T } from "../../theme";

export function Dashboard({ ctx, reqs, assets }) {
  const { user, perm, D, go } = ctx;
  const pending = reqs.filter((r) => reqStatus(r) === "pending");
  const awaitingMe = pending.filter((r) => needsMyAction(r, ctx));
  const approved = reqs.filter((r) => reqStatus(r) === "approved");
  const procured = reqs.filter((r) => reqStatus(r) === "procured");
  const live = assets.filter((a) => a.status !== "disposed");
  const thisMonth = procured.filter((r) => monthKey(r.procurement.at) === "2026-08");
  const spendThisMonth = thisMonth.reduce((s, r) => s + r.procurement.actualCost, 0);

  return (
    <div className="space-y-5">
      <PageHead title={`Good morning, ${user.name.split(" ")[0]}`} sub={fmtDate(TODAY.toISOString())} />

      {(() => {
        const mineLate = reqs.filter((r) => {
          const e = escalation(r);
          return e && stageApprover(r, e.stage, ctx.dealerships, ctx.departments) === user.id;
        });
        const covered = escalationRecords(reqs, ctx.dealerships, ctx.departments).filter((x) => x.state === "covered" && x.ownerId === user.id);
        if (!mineLate.length && !covered.length) return null;
        return (
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <SectionTitle icon={AlertTriangle}>
                  {mineLate.length > 0
                    ? `${mineLate.length} of your approvals ${mineLate.length > 1 ? "are" : "is"} overdue`
                    : `${covered.length} approval${covered.length > 1 ? "s" : ""} escalated past you`}
                </SectionTitle>
                <p className="mt-1 text-[13px]" style={{ color: T.sub }}>
                  {mineLate.length > 0
                    ? `Past the ${LIMITS.slaDays}-day window — the Director can now act in your place.`
                    : "The Director stepped in on these after no response."}
                </p>
              </div>
              <Btn size="sm" kind="secondary" onClick={() => go("escalations")}>View</Btn>
            </div>
          </Card>
        );
      })()}

      {(() => {
        const toAccept = assets.filter((a) => a.assignedTo === user.id && !a.acceptance && a.status !== "disposed");
        if (!toAccept.length) return null;
        return (
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <SectionTitle icon={UserCheck}>{toAccept.length} asset{toAccept.length > 1 ? "s" : ""} issued to you, awaiting your confirmation</SectionTitle>
                <p className="mt-1 text-[13px]" style={{ color: T.sub }}>Confirm receipt so custody is on record.</p>
              </div>
              <Btn size="sm" onClick={() => go("assetdetail", toAccept[0].id)}>Review</Btn>
            </div>
          </Card>
        );
      })()}

      {awaitingMe.length > 0 && (
        <Card className="border-l-4" >
          <div className="flex items-start justify-between gap-3">
            <div>
              <SectionTitle icon={AlertTriangle}>{awaitingMe.length} requisition{awaitingMe.length > 1 ? "s" : ""} need your approval</SectionTitle>
              <p className="mt-1 text-[13px]" style={{ color: T.sub }}>Your signature is pending on these.</p>
            </div>
            <Btn size="sm" onClick={() => go("reqs")}>Review</Btn>
          </div>
        </Card>
      )}

      {perm.canExecutePayment && reqs.filter((r) => TO_PAY.includes(payStatus(r))).length > 0 && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <SectionTitle icon={Landmark}>
                {reqs.filter((r) => TO_PAY.includes(payStatus(r))).length} payment{reqs.filter((r) => TO_PAY.includes(payStatus(r))).length > 1 ? "s" : ""} approved and ready to pay
              </SectionTitle>
              <p className="mt-1 text-[13px]" style={{ color: T.sub }}>
                {inrFull(reqs.filter((r) => TO_PAY.includes(payStatus(r))).reduce((s, r) => s + dueAmount(r), 0))} to transfer — enter the UTR once paid.
              </p>
            </div>
            <Btn size="sm" onClick={() => go("payments")}>Open</Btn>
          </div>
        </Card>
      )}

      {perm.canApproveAdvance && reqs.filter((r) => needsPaymentAction(r, user, perm)).length > 0 && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <SectionTitle icon={Landmark}>
                {reqs.filter((r) => payStatus(r) === "advance_approval").length} vendor advance{reqs.filter((r) => payStatus(r) === "advance_approval").length > 1 ? "s" : ""} awaiting your approval
              </SectionTitle>
              <p className="mt-1 text-[13px]" style={{ color: T.sub }}>
                Both purchase approvals are in — {inrFull(reqs.filter((r) => payStatus(r) === "advance_approval").reduce((s, r) => s + r.advance.amount, 0))} to approve for payment.
              </p>
            </div>
            <Btn size="sm" onClick={() => go("payments")}>Review</Btn>
          </div>
        </Card>
      )}

      {perm.isDirector && (() => {
        const recs = escalationRecords(reqs, ctx.dealerships, ctx.departments);
        const openN = recs.filter((x) => x.state === "open").length;
        const coveredN = recs.filter((x) => x.state === "covered").length;
        if (!openN && !coveredN) return null;
        return (
          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <SectionTitle icon={AlertTriangle}>
                  {openN > 0 ? `${openN} approval${openN > 1 ? "s" : ""} overdue across the group` : `${coveredN} escalated approval${coveredN > 1 ? "s" : ""} on record`}
                </SectionTitle>
                <p className="mt-1 text-[13px]" style={{ color: T.sub }}>
                  {openN > 0 ? `Past the ${LIMITS.slaDays}-day window — you can approve in their place. ` : ""}
                  You have stepped in {coveredN} time{coveredN === 1 ? "" : "s"} so far.
                </p>
              </div>
              <Btn size="sm" kind="secondary" onClick={() => go("escalations")}>View</Btn>
            </div>
          </Card>
        );
      })()}

      {perm.isDirector && reqs.filter((r) => needsPaymentAction(r, user, perm)).length > 0 && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <SectionTitle icon={ShieldCheck}>
                {reqs.filter((r) => needsPaymentAction(r, user, perm)).length} payment{reqs.filter((r) => needsPaymentAction(r, user, perm)).length > 1 ? "s" : ""} awaiting your approval
              </SectionTitle>
              <p className="mt-1 text-[13px]" style={{ color: T.sub }}>
                {inrFull(reqs.filter((r) => needsPaymentAction(r, user, perm)).reduce((s, r) => s + dueAmount(r), 0))} held — includes large advances and final payments over {inrShort(LIMITS.directorPayment)}.
              </p>
            </div>
            <Btn size="sm" onClick={() => go("payments")}>Review</Btn>
          </div>
        </Card>
      )}

      {perm.canFinanceSignoff && reqs.filter((r) => needsPaymentAction(r, user, perm)).length > 0 && (
        <Card>
          <div className="flex items-start justify-between gap-3">
            <div>
              <SectionTitle icon={ShieldCheck}>
                {reqs.filter((r) => needsPaymentAction(r, user, perm)).length} item{reqs.filter((r) => needsPaymentAction(r, user, perm)).length > 1 ? "s" : ""} awaiting your sign-off
              </SectionTitle>
              <p className="mt-1 text-[13px]" style={{ color: T.sub }}>
                {inrFull(reqs.filter((r) => needsPaymentAction(r, user, perm)).reduce((s, r) => s + dueAmount(r), 0))} held — final payments and advances over {inrShort(LIMITS.advanceEscalation)}.
              </p>
            </div>
            <Btn size="sm" onClick={() => go("payments")}>Review</Btn>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Awaiting approval" value={String(pending.length)} icon={Clock} tone={pending.length ? "warn" : undefined} />
        <Stat label="Approved, to procure" value={String(approved.length)} icon={Package} accent />
        <Stat label="Procured (Aug 2026)" value={String(thisMonth.length)} icon={TrendingUp} />
        <Stat label="Spend (Aug 2026)" value={inrShort(spendThisMonth)} icon={Landmark} accent />
      </div>

      {perm.isDirector && (
        <Card>
          <SectionTitle icon={TrendingUp}>Last month at a glance — Aug 2026</SectionTitle>
          <p className="mt-1 text-[13px]" style={{ color: T.sub }}>Procured by corporate functions, across all dealerships.</p>
          <div className="mt-3 space-y-2">
            {thisMonth.map((r) => (
              <button key={r.id} onClick={() => go("reqdetail", r.id)} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left" style={{ background: T.canvas }}>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{r.item}</div>
                  <div className="text-[11px]" style={{ color: T.sub }}>{D(r.dealershipId).name} · by {ctx.U(r.procurement.by).name}</div>
                </div>
                <span className="ml-2 shrink-0 text-sm font-bold">{inrShort(r.procurement.actualCost)}</span>
              </button>
            ))}
            <div className="flex items-center justify-between px-3 pt-2" style={{ borderTop: "1px solid " + T.line }}>
              <span className="text-sm font-bold">Total</span>
              <span className="text-sm font-bold" style={{ color: T.primary }}>{inrFull(spendThisMonth)}</span>
            </div>
          </div>
          <div className="mt-3"><Btn kind="secondary" size="sm" onClick={() => go("procurement")}>Full procurement report</Btn></div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card>
          <SectionTitle icon={Boxes}>Asset register</SectionTitle>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <MiniStat label="Live assets" value={String(live.length)} />
            <MiniStat label="Net book value" value={inrShort(live.reduce((s, a) => s + (depreciation(a)?.nbv ?? a.cost), 0))} />
            <MiniStat label="Procured via app" value={String(live.filter((a) => a.source === "procured").length)} />
            <MiniStat label="Opening stock" value={String(live.filter((a) => a.source === "existing").length)} />
          </div>
        </Card>
        <Card>
          <SectionTitle icon={FileText}>Requisition pipeline</SectionTitle>
          <div className="mt-3 space-y-2">
            {Object.entries(REQ_STATUS).map(([k, v]) => {
              const n = reqs.filter((r) => reqStatus(r) === k).length;
              return (
                <div key={k} className="flex items-center justify-between text-sm">
                  <span style={{ color: T.sub }}>{v.label}</span>
                  <span className="font-bold" style={{ color: v.c }}>{n}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
