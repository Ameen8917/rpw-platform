import {
  ShieldCheck, Calendar, AlertTriangle, Clock, Users,
} from "lucide-react";
import { Card, Empty, PageHead, SectionTitle, Stat, Td, Th } from "../../components/ui";
import { LIMITS } from "../../domain/config";
import { approvalLoad, escalationRecords } from "../../domain/requisitions";
import { fmtDate } from "../../lib/format";
import { T } from "../../theme";

export function Escalations({ ctx, reqs }) {
  const { user, perm, dealerships, departments, D, DEP, U, go } = ctx;
  const all = escalationRecords(reqs, dealerships, departments);
  /* An approver sees their own record; the Director sees everyone's */
  const rows = perm.isDirector ? all : all.filter((x) => x.ownerId === user.id);
  const open = rows.filter((x) => x.state === "open");
  const covered = rows.filter((x) => x.state === "covered");
  const mineWording = !perm.isDirector;

  return (
    <div className="space-y-4">
      <PageHead title="Escalations"
        sub={mineWording ? "Approvals of yours that ran past the response time" : "Approvals that ran past the response time, group-wide"} />

      <div className="rounded-lg px-3 py-2.5 text-[12px]" style={{ background: T.canvas, color: T.sub }}>
        An approval left unanswered for {LIMITS.slaDays} days escalates to the Director, who may act in their place. The approver keeps the ability to act until then, and every instance is recorded here.
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={mineWording ? "Overdue with you" : "Currently overdue"} value={String(open.length)} icon={AlertTriangle} tone={open.length ? "bad" : undefined} />
        <Stat label={mineWording ? "Director stepped in" : "You stepped in"} value={String(covered.length)} icon={ShieldCheck} tone={covered.length ? "warn" : undefined} />
        <Stat label="Longest wait" value={rows.length ? `${Math.max(...rows.map((x) => x.days || 0))}d` : "—"} icon={Clock} />
        <Stat label="Response window" value={`${LIMITS.slaDays} days`} icon={Calendar} />
      </div>

      {perm.isDirector && (() => {
        /* Per-approver tally — who keeps letting approvals lapse */
        const byPerson: Record<string, { open: number; covered: number; worst: number }> = {};
        all.forEach((x) => {
          if (!x.ownerId) return;
          const b = byPerson[x.ownerId] || (byPerson[x.ownerId] = { open: 0, covered: 0, worst: 0 });
          b[x.state] += 1;
          b.worst = Math.max(b.worst, x.days || 0);
        });
        const load = approvalLoad(reqs, dealerships, departments);
        const ranked = Object.entries(byPerson)
          .map(([id, b]) => {
            const total = b.open + b.covered;
            const handled = Math.max(load[id] || 0, total);
            return { id, ...b, total, handled, rate: (total / handled) * 100 };
          })
          .sort((a, b) => b.rate - a.rate || b.total - a.total);
        if (!ranked.length) return null;
        const maxTotal = Math.max(...ranked.map((x) => x.total));
        return (
          <Card>
            <SectionTitle icon={Users}>Late approvals by person</SectionTitle>
            <p className="mt-1 text-[13px]" style={{ color: T.sub }}>
              Late approvals against the number each person has handled, so a busy approver is not penalised for volume. Read the rate, not the raw count — and treat small denominators with caution.
            </p>
            <div className="mt-3 hidden md:block">
              <table className="w-full border-collapse text-sm">
                <thead><tr style={{ background: T.canvas, color: T.sub }}>
                  <Th>Approver</Th><Th>Role</Th><Th right>Overdue now</Th><Th right>You stepped in</Th><Th right>Late</Th><Th right>Handled</Th><Th right>Late rate</Th><Th right>Worst wait</Th>
                </tr></thead>
                <tbody>
                  {ranked.map((x, i) => (
                    <tr key={x.id} style={{ borderTop: i ? "1px solid " + T.line : "none" }}>
                      <Td><span className="font-semibold">{U(x.id)?.name}</span></Td>
                      <Td sub>{U(x.id)?.title}</Td>
                      <Td right>{x.open > 0 ? <span className="font-semibold" style={{ color: T.bad }}>{x.open}</span> : <span style={{ color: T.sub }}>—</span>}</Td>
                      <Td right>{x.covered > 0 ? <span className="font-semibold" style={{ color: T.warn }}>{x.covered}</span> : <span style={{ color: T.sub }}>—</span>}</Td>
                      <Td right><span className="font-semibold">{x.total}</span></Td>
                      <Td right sub>{x.handled}</Td>
                      <Td right>
                        <span className="whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium"
                          style={x.rate >= 50 ? { color: T.bad, background: T.badBg } : x.rate >= 25 ? { color: T.warn, background: T.warnBg } : { color: T.ok, background: T.okBg }}>
                          {x.rate.toFixed(0)}%
                        </span>
                      </Td>
                      <Td right sub>{x.worst}d</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 space-y-3 md:hidden">
              {ranked.map((x) => (
                <div key={x.id}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold">{U(x.id)?.name}</span>
                    <span style={{ color: T.sub }}>{x.total} late of {x.handled} · {x.rate.toFixed(0)}%</span>
                  </div>
                  <div className="flex h-2 w-full overflow-hidden rounded-full" style={{ background: T.canvas }}>
                    <div className="h-full" style={{ width: `${(x.open / maxTotal) * 100}%`, background: T.bad }} />
                    <div className="h-full" style={{ width: `${(x.covered / maxTotal) * 100}%`, background: T.warn }} />
                  </div>
                </div>
              ))}
              <div className="flex gap-3 text-[10px]" style={{ color: T.sub }}>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: T.bad }} />overdue now</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: T.warn }} />you stepped in</span>
              </div>
            </div>
          </Card>
        );
      })()}

      {open.length > 0 && (
        <Card>
          <SectionTitle icon={AlertTriangle}>{mineWording ? "Waiting on you now" : "Waiting now"}</SectionTitle>
          <p className="mt-1 text-[13px]" style={{ color: T.sub }}>
            {mineWording ? "Act on these before the Director has to." : "Past the response window — you can approve in their place."}
          </p>
          <div className="mt-3 space-y-2">
            {open.map((x, i) => (
              <button key={"o" + i} onClick={() => go("reqdetail", x.r.id)} className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left" style={{ background: T.badBg }}>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{x.r.item}</div>
                  <div className="text-[11px]" style={{ color: T.sub }}>
                    {x.r.ref} · {D(x.r.dealershipId).name} · {x.stage === "bh" ? "Business Head" : `${DEP(x.r.deptId).name} Head`}
                    {!mineWording && x.ownerId ? ` · ${U(x.ownerId)?.name}` : ""}
                  </div>
                </div>
                <span className="shrink-0 text-xs font-semibold" style={{ color: T.bad }}>{x.days}d waiting</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle icon={ShieldCheck}>{mineWording ? "Where the Director stepped in for you" : "Approvals you gave on escalation"}</SectionTitle>
        {covered.length === 0 ? <Empty msg="No instances recorded." /> : (
          <div className="mt-3 space-y-2">
            {covered.map((x, i) => (
              <button key={"c" + i} onClick={() => go("reqdetail", x.r.id)} className="flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2.5 text-left" style={{ background: T.warnBg }}>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{x.r.item}</div>
                  <div className="text-[11px]" style={{ color: T.sub }}>
                    {x.r.ref} · {D(x.r.dealershipId).name} · {x.stage === "bh" ? "Business Head" : `${DEP(x.r.deptId).name} Head`}
                    {!mineWording && x.ownerId ? ` · ${U(x.ownerId)?.name}` : ""}
                  </div>
                  <div className="mt-0.5 text-[11px]" style={{ color: T.warn }}>
                    Approved by {U(x.actedBy)?.name} on {fmtDate(x.at)} after {x.days} days without response
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
