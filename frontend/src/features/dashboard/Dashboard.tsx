import { useState } from "react";
import {
  ShieldCheck, UserCheck, AlertTriangle, Landmark, ArrowUpRight, ChevronRight, X,
} from "lucide-react";
import { BarList, ColumnChart, Segmented, StackedBar } from "../../components/charts";
import { Btn, Card, PageHead, SectionTitle } from "../../components/ui";
import { depreciation } from "../../domain/assets";
import {
  approvalsByStage, custodyBreakdown, monthLabel, monthWindow, paymentPhases, purchasesOf, rankBy, spendByMonth,
} from "../../domain/dashboard";
import { LIMITS } from "../../domain/config";
import { TO_PAY, dueAmount, needsPaymentAction, payStatus } from "../../domain/payments";
import { escalation, escalationRecords, needsMyAction, reqStatus, stageApprover } from "../../domain/requisitions";
import { TODAY, inrFull, inrShort, monthKey } from "../../lib/format";
import { T } from "../../theme";

export function Dashboard({ ctx, reqs, assets }) {
  const { user, perm, D, go } = ctx;
  const pending = reqs.filter((r) => reqStatus(r) === "pending");
  const awaitingMe = pending.filter((r) => needsMyAction(r, ctx));
  const approved = reqs.filter((r) => reqStatus(r) === "approved");
  const procured = reqs.filter((r) => reqStatus(r) === "procured");
  const live = assets.filter((a) => a.status !== "disposed");

  /* Spending section: a period ending this month, optionally narrowed to one month by the chart */
  const [range, setRange] = useState(6);
  const [month, setMonth] = useState<string | null>(null);
  const months = monthWindow(monthKey(TODAY.toISOString()), range);
  const purchases = purchasesOf(procured).filter((p) => months.includes(p.month));
  const series = spendByMonth(purchases, months);
  const scoped = month ? purchases.filter((p) => p.month === month) : purchases;
  const spend = scoped.reduce((s, p) => s + p.cost, 0);
  const periodLabel = month ? monthLabel(month, true) : `Last ${range} months`;
  /* Compared with the month before the selected one, when that month is in range */
  const prev = month ? series[months.indexOf(month) - 1] : null;
  const prevNote = !prev || prev.spend === 0 ? null
    : `${spend >= prev.spend ? "▲" : "▼"} ${Math.abs(Math.round(((spend - prev.spend) / prev.spend) * 100))}% vs ${monthLabel(prev.month)}`;
  const scopedIds = new Set(scoped.map((p) => p.id));
  const topPurchases = procured.filter((r) => scopedIds.has(r.id))
    .sort((a, b) => b.procurement.actualCost - a.procurement.actualCost).slice(0, 5);
  const nbvTotal = live.reduce((s, a) => s + (depreciation(a)?.nbv ?? a.cost), 0);

  /* Operations now: where work and money are waiting, module by module */
  const stages = approvalsByStage(reqs);
  const overdueN = stages.reduce((s, x) => s + x.overdue, 0);
  const phases = paymentPhases(reqs);
  const owed = phases.filter((p) => p.key !== "advance_out");
  const owedTotal = owed.reduce((s, p) => s + p.amount, 0);
  const readyToPay = phases.find((p) => p.key === "to_pay");
  const custody = custodyBreakdown(assets);
  const awaitingAck = custody.find((g) => g.key === "awaiting").count;
  const toProcureValue = approved.reduce((s, r) => s + (Number(r.estCost) || 0), 0);

  return (
    <div className="space-y-7">
      <PageHead title={`Good morning, ${user.name.split(" ")[0]}`} />

      <section className="hidden space-y-2 has-[.attn]:block">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: T.sub }}>Needs your attention</h2>
        <Card pad={false} className="divide-y divide-line">
          {(() => {
            const mineLate = reqs.filter((r) => {
              const e = escalation(r);
              return e && stageApprover(r, e.stage, ctx.dealerships, ctx.departments) === user.id;
            });
            const covered = escalationRecords(reqs, ctx.dealerships, ctx.departments).filter((x) => x.state === "covered" && x.ownerId === user.id);
            if (!mineLate.length && !covered.length) return null;
            return (
              <>
                <div className="attn flex items-start justify-between gap-4 px-4 py-4 md:px-5">
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
              </>
            );
          })()}
    
          {(() => {
            const toAccept = assets.filter((a) => a.assignedTo === user.id && !a.acceptance && a.status !== "disposed");
            if (!toAccept.length) return null;
            return (
              <>
                <div className="attn flex items-start justify-between gap-4 px-4 py-4 md:px-5">
                  <div>
                    <SectionTitle icon={UserCheck}>{toAccept.length} asset{toAccept.length > 1 ? "s" : ""} issued to you, awaiting your confirmation</SectionTitle>
                    <p className="mt-1 text-[13px]" style={{ color: T.sub }}>Confirm receipt so custody is on record.</p>
                  </div>
                  <Btn size="sm" onClick={() => go("assetdetail", toAccept[0].id)}>Review</Btn>
                </div>
              </>
            );
          })()}
    
          {awaitingMe.length > 0 && (
            <>
              <div className="attn flex items-start justify-between gap-4 px-4 py-4 md:px-5">
                <div>
                  <SectionTitle icon={AlertTriangle}>{awaitingMe.length} requisition{awaitingMe.length > 1 ? "s need" : " needs"} your approval</SectionTitle>
                  <p className="mt-1 text-[13px]" style={{ color: T.sub }}>Your signature is pending on these.</p>
                </div>
                <Btn size="sm" onClick={() => go("reqs")}>Review</Btn>
              </div>
            </>
          )}
    
          {perm.canExecutePayment && reqs.filter((r) => TO_PAY.includes(payStatus(r))).length > 0 && (
            <>
              <div className="attn flex items-start justify-between gap-4 px-4 py-4 md:px-5">
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
            </>
          )}
    
          {perm.canApproveAdvance && reqs.filter((r) => needsPaymentAction(r, user, perm)).length > 0 && (
            <>
              <div className="attn flex items-start justify-between gap-4 px-4 py-4 md:px-5">
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
            </>
          )}
    
          {perm.isDirector && reqs.filter((r) => needsPaymentAction(r, user, perm)).length > 0 && (
            <>
              <div className="attn flex items-start justify-between gap-4 px-4 py-4 md:px-5">
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
            </>
          )}
    
          {perm.canFinanceSignoff && reqs.filter((r) => needsPaymentAction(r, user, perm)).length > 0 && (
            <>
              <div className="attn flex items-start justify-between gap-4 px-4 py-4 md:px-5">
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
            </>
          )}
    
            </Card>
      </section>

      {/* One headline per module; each opens the screen behind it */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Approvals waiting" value={String(pending.length)}
          sub={awaitingMe.length ? `${awaitingMe.length} need your signature` : "None waiting on you"} onClick={() => go("reqs")} />
        <Kpi label="Approved, to procure" value={String(approved.length)}
          sub={approved.length ? `${inrShort(toProcureValue)} estimated` : "Nothing waiting"} onClick={() => go("procurement")} />
        {perm.canSeePayments
          ? <Kpi label="Payments outstanding" value={inrShort(owedTotal)} accent
              sub={readyToPay.count ? `${inrShort(readyToPay.amount)} ready to transfer` : "Nothing ready to transfer"} onClick={() => go("payments")} />
          : <Kpi label="Spend" value={inrShort(spend)} accent sub={periodLabel} onClick={() => go("procurement")} />}
        <Kpi label="Live assets" value={String(live.length)}
          sub={awaitingAck ? `${awaitingAck} awaiting acknowledgement` : `${inrShort(nbvTotal)} book value`}
          onClick={() => go(perm.isDirector || perm.isBH || perm.isFnHead ? "custody" : "assets")} />
      </div>

      {/* Where work and money are waiting right now */}
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: T.sub }}>Operations now</h2>
        <div className={perm.canSeePayments ? "grid grid-cols-1 gap-3 lg:grid-cols-3" : "grid grid-cols-1 gap-3 lg:grid-cols-2"}>
          <Card>
            <SectionTitle>Approvals waiting, by stage</SectionTitle>
            <p className="mt-0.5 text-[12.5px]" style={{ color: T.sub }}>Whose signature each requisition needs next.</p>
            <div className="-mx-2 mt-3">
              <BarList format={(v) => String(v)} onPick={() => go("reqs")}
                rows={stages.map((s) => ({
                  key: s.key, label: s.label, value: s.onTime + s.overdue,
                  note: s.overdue ? `${s.overdue} overdue` : undefined,
                  /* Neutral for on time, so only the overdue part draws the eye */
                  parts: [{ key: "on", value: s.onTime, color: T.sub }, { key: "late", value: s.overdue, color: T.bad }],
                }))} />
            </div>
            <Legend items={[{ label: `Within ${LIMITS.slaDays} days`, color: T.sub }, { label: "Overdue", color: T.bad }]} />
            {perm.isDirector && overdueN > 0 && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-md px-3 py-2 text-[12.5px]" style={{ background: T.badBg }}>
                <span style={{ color: T.ink }}>{overdueN} overdue — you can approve in their place.</span>
                <Btn size="sm" kind="secondary" onClick={() => go("escalations")}>Step in</Btn>
              </div>
            )}
          </Card>

          {perm.canSeePayments && (
            <Card>
              <SectionTitle>Payments in progress</SectionTitle>
              <p className="mt-0.5 text-[12.5px]" style={{ color: T.sub }}>Money owed to vendors, and advances already out.</p>
              <div className="-mx-2 mt-3">
                <BarList format={inrShort} onPick={() => go("payments")}
                  rows={phases.map((p) => ({ key: p.key, label: p.label, value: p.amount, note: `· ${p.count} requisition${p.count === 1 ? "" : "s"}` }))} />
              </div>
            </Card>
          )}

          <Card>
            <div className="flex items-baseline justify-between gap-3">
              <SectionTitle>Asset custody</SectionTitle>
              <span className="text-[12px]" style={{ color: T.sub }}>{live.length} live</span>
            </div>
            <p className="mt-0.5 text-[12.5px]" style={{ color: T.sub }}>Who holds what, and whether they have acknowledged it.</p>
            <div className="mt-5">
              <StackedBar onPick={() => go(perm.isDirector || perm.isBH || perm.isFnHead ? "custody" : "assets")}
                segments={custody.map((g) => ({ key: g.key, label: g.label, value: g.count, color: CUSTODY_COLOR[g.key] }))} />
            </div>
          </Card>
        </div>
      </section>


      {/* Spending: one filter row scopes everything in this section */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: T.sub }}>Spending</h2>
          <div className="flex flex-wrap items-center gap-2">
            {month && (
              <button type="button" onClick={() => setMonth(null)} aria-label={`Clear the ${monthLabel(month, true)} filter`}
                className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium hover:bg-hover"
                style={{ border: "1px solid " + T.line, color: T.ink, background: T.surface }}>
                {monthLabel(month, true)}<X size={12} style={{ color: T.sub }} />
              </button>
            )}
            <Segmented label="Period" value={range} onChange={(v) => { setRange(v); setMonth(null); }}
              options={[{ value: 3, label: "3M" }, { value: 6, label: "6M" }, { value: 12, label: "12M" }]} />
          </div>
        </div>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
            <div>
              <SectionTitle>Procurement spend by month</SectionTitle>
              <p className="mt-0.5 text-[12.5px]" style={{ color: T.sub }}>
                {month ? "Focused on one month. Click it again, or clear the filter, for the whole period." : "Click a month to focus the figures below on it."}
              </p>
            </div>
            <div className="sm:text-right">
              <div className="text-[24px] font-semibold leading-none tracking-tight">{inrShort(spend)}</div>
              <div className="mt-1 text-[11.5px]" style={{ color: T.sub }}>{scoped.length} purchase{scoped.length === 1 ? "" : "s"} · {periodLabel}{prevNote && <> · {prevNote}</>}</div>
            </div>
          </div>
          <div className="mt-6">
            <ColumnChart label="Procurement spend by month" selected={month} onSelect={setMonth} format={inrShort} height={104} tickCount={2}
              data={series.map((m) => ({
                key: m.month, label: monthLabel(m.month), title: monthLabel(m.month, true), value: m.spend,
                detail: `${m.count} purchase${m.count === 1 ? "" : "s"}`,
              }))} />
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <Card>
            <SectionTitle>Spend by dealership</SectionTitle>
            <p className="mt-0.5 text-[12.5px]" style={{ color: T.sub }}>{periodLabel}</p>
            <div className="-mx-2 mt-3">
              <BarList format={inrShort} empty="No purchases in this period."
                rows={rankBy(scoped.map((p) => ({ key: p.dealershipId, value: p.cost }))).map((r) => ({
                  key: r.key, value: r.value,
                  label: r.key === "__other" ? `Other (${"others" in r ? r.others : 0})` : D(r.key)?.name || r.key,
                }))} />
            </div>
          </Card>

          <Card>
            <div className="flex items-start justify-between gap-3">
              <div>
                <SectionTitle>Largest purchases</SectionTitle>
                <p className="mt-0.5 text-[12.5px]" style={{ color: T.sub }}>{periodLabel}</p>
              </div>
              <Btn kind="ghost" size="sm" onClick={() => go("procurement")}>Full report</Btn>
            </div>
            <div className="-mx-2 mt-2">
              {topPurchases.length === 0 && <p className="py-6 text-center text-[13px]" style={{ color: T.sub }}>No purchases in this period.</p>}
              {topPurchases.map((r) => (
                <button key={r.id} type="button" onClick={() => go("reqdetail", r.id)}
                  className="group flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left hover:bg-hover">
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium">{r.item}</div>
                    <div className="truncate text-[11.5px]" style={{ color: T.sub }}>
                      {D(r.dealershipId)?.name} · {monthLabel(r.procurement.at.slice(0, 7), true)}
                    </div>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-[13.5px] font-semibold tabular-nums">
                    {inrShort(r.procurement.actualCost)}
                    <ChevronRight size={14} className="opacity-0 transition-opacity group-hover:opacity-60" />
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

/* A headline figure that opens the screen behind it */
function Kpi({ label, value, sub, tone, accent, onClick }: {
  label: string; value: string; sub?: string; tone?: "warn"; accent?: boolean; onClick?: () => void;
}) {
  const c = tone === "warn" ? T.warn : accent ? T.chart : T.ink;
  return (
    <button type="button" onClick={onClick}
      className="group flex min-w-0 flex-col rounded-lg p-4 text-left transition-[border-color,box-shadow] duration-150 hover:border-line-strong hover:shadow-md md:p-5"
      style={{ background: T.surface, border: "1px solid " + T.line, boxShadow: "0 1px 2px " + T.shadow }}>
      <div className="flex w-full items-center justify-between gap-2 text-[12px] font-medium" style={{ color: T.sub }}>
        {label}
        <ArrowUpRight size={14} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
      {/* Sans, not the display serif: its ₹ glyph renders poorly */}
      <div className="mt-2 text-[28px] font-semibold leading-none tracking-tight" style={{ color: c }}>{value}</div>
      {sub && <div className="mt-2 w-full truncate text-[11.5px]" style={{ color: T.sub }}>{sub}</div>}
    </button>
  );
}

/* Custody states use the status colours: done, needs a nudge, idle, out of use */
const CUSTODY_COLOR = { acknowledged: T.ok, awaiting: T.warn, storage: T.slate, repair: T.bad };

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px]" style={{ color: T.sub }}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: i.color }} />{i.label}
        </span>
      ))}
    </div>
  );
}
