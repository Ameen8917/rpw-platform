import { useState } from "react";
import {
  Bell,
} from "lucide-react";
import { PAY_STATUS, advanceOutstanding, dueAmount, needsPaymentAction, payStatus } from "../../domain/payments";
import { escalation, needsMyAction } from "../../domain/requisitions";
import { inrShort } from "../../lib/format";
import { T } from "../../theme";

export function NotificationBell({ ctx, reqs, go }) {
  const { user, perm, D } = ctx;
  const [open, setOpen] = useState(false);
  const items = [];
  reqs.forEach((r) => {
    if (needsMyAction(r, ctx)) {
      const esc = escalation(r);
      items.push({ id: r.id + "-a", r, kind: esc ? "escalated" : "approval",
        text: esc ? `Escalated — ${r.item}` : `Approval needed — ${r.item}`,
        sub: esc ? `No response for ${esc.days} days · ${D(r.dealershipId).name}` : `${D(r.dealershipId).name} · ${inrShort(r.estCost)}` });
    }
    if (needsPaymentAction(r, user, perm)) {
      items.push({ id: r.id + "-p", r, kind: "payment",
        text: `${PAY_STATUS[payStatus(r)].label} — ${r.item}`,
        sub: `${D(r.dealershipId).name} · ${inrShort(dueAmount(r))}` });
    }
    const ao = advanceOutstanding(r);
    if (ao && (perm.isAccounts || perm.isExecutive || perm.isDirector)) {
      items.push({ id: r.id + "-o", r, kind: "overdue",
        text: `Advance outstanding — ${r.item}`,
        sub: `${inrShort(ao.amount)} paid, goods ${ao.days} days overdue` });
    }
  });
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center rounded-md hover:bg-black/[0.05]">
        <Bell size={17} strokeWidth={1.75} style={{ color: items.length ? T.ink : T.sub }} />
        {items.length > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9.5px] font-semibold text-white" style={{ background: T.bad, boxShadow: "0 0 0 2px " + T.canvas }}>
            {items.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-[min(20rem,calc(100vw-24px))] overflow-y-auto rounded-lg py-2 shadow-xl" style={{ background: T.surface, border: "1px solid " + T.line, WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: T.sub }}>
              {items.length ? `${items.length} item${items.length > 1 ? "s" : ""} need you` : "Nothing pending"}
            </div>
            {items.length === 0 && <div className="px-3 py-4 text-center text-sm" style={{ color: T.sub }}>You are all caught up.</div>}
            {items.map((n) => (
              <button key={n.id} onClick={() => { go("reqdetail", n.r.id); setOpen(false); }}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-slate-50">
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: n.kind === "escalated" || n.kind === "overdue" ? T.bad : n.kind === "payment" ? T.accent : T.primary }} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold" style={{ color: T.ink }}>{n.text}</span>
                  <span className="block truncate text-[11px]" style={{ color: T.sub }}>{n.sub}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
