import { useState } from "react";
import {
  Search, Plus, ChevronRight,
} from "lucide-react";
import { Btn, Card, Empty, PageHead, Td, Th } from "../../components/ui";
import { reqStatus } from "../../domain/requisitions";
import { ApprovalPips, ReqBadge } from "./RequisitionBits";
import { inrShort } from "../../lib/format";
import { T } from "../../theme";

export function Requisitions({ ctx, reqs }) {
  const { perm, D, DEP, U, go } = ctx;
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const tabs = [["all", "All"], ["pending", "Pending"], ["approved", "Approved"], ["procured", "Procured"], ["rejected", "Rejected"]];
  const rows = reqs.filter((r) => (tab === "all" || reqStatus(r) === tab) &&
    (!q || (r.item + r.ref + D(r.dealershipId).name).toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageHead title="Requisitions" sub={perm.isDirector ? "All requests, group-wide" : perm.isFnHead ? `${DEP(ctx.user.deptId)?.name} requests across dealerships` : "Your dealership"} />
        {perm.canRaise && <div className="hidden md:block"><Btn icon={Plus} onClick={() => go("newreq")}>Raise requisition</Btn></div>}
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg p-1" style={{ background: T.surface, border: "1px solid " + T.line }}>
        {tabs.map(([k, l]) => {
          const n = k === "all" ? reqs.length : reqs.filter((r) => reqStatus(r) === k).length;
          return (
            <button key={k} onClick={() => setTab(k)} className="flex-1 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold"
              style={tab === k ? { background: T.primarySoft, color: T.primary } : { color: T.sub }}>{l} <span className="opacity-60">({n})</span></button>
          );
        })}
      </div>

      <Card pad={false}>
        <div className="flex items-center gap-2 p-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2" style={{ border: "1px solid " + T.line }}>
            <Search size={16} style={{ color: T.sub }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search item, ref, dealership…" className="w-full text-sm outline-none" />
          </div>
        </div>
      </Card>

      {rows.length === 0 ? <Card><Empty msg="Nothing here." /></Card> : (
        <>
          <div className="space-y-2 md:hidden">
            {rows.map((r) => <ReqCard key={r.id} r={r} ctx={ctx} />)}
          </div>
          <Card pad={false} className="hidden overflow-hidden md:block">
            <table className="w-full border-collapse text-sm">
              <thead><tr style={{ background: T.canvas, color: T.sub }}>
                <Th>Ref / item</Th><Th>Dealership</Th><Th>Dept</Th><Th>Raised by</Th><Th>Approvals</Th><Th right>Value</Th><Th>Status</Th><Th right />
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} onClick={() => go("reqdetail", r.id)} className="cursor-pointer hover:bg-slate-50" style={{ borderTop: i ? "1px solid " + T.line : "none" }}>
                    <Td><div className="font-semibold">{r.item}</div><div className="font-mono text-[11px]" style={{ color: T.sub }}>{r.ref}</div></Td>
                    <Td sub>{D(r.dealershipId).name}</Td>
                    <Td sub>{DEP(r.deptId).name}</Td>
                    <Td sub>{U(r.raisedBy).name}</Td>
                    <Td><ApprovalPips r={r} ctx={ctx} /></Td>
                    <Td right><span className="font-semibold">{inrShort(r.procurement ? r.procurement.actualCost : r.estCost)}</span></Td>
                    <Td><ReqBadge s={reqStatus(r)} /></Td>
                    <Td right><ChevronRight size={16} style={{ color: T.sub, display: "inline" }} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {perm.canRaise && (
        <button onClick={() => go("newreq")} className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg md:hidden" style={{ background: T.primary }}>
          <Plus size={24} />
        </button>
      )}
    </div>
  );
}

export function ReqCard({ r, ctx }) {
  const { D, DEP, go } = ctx;
  return (
    <button onClick={() => go("reqdetail", r.id)} className="w-full text-left">
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{r.item}</div>
            <div className="mt-1 flex flex-wrap gap-x-3 text-[11px]" style={{ color: T.sub }}>
              <span className="font-mono">{r.ref}</span>
              <span>{D(r.dealershipId).name}</span>
              <span>{DEP(r.deptId).name}</span>
            </div>
            <div className="mt-2"><ApprovalPips r={r} ctx={ctx} /></div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-sm font-semibold">{inrShort(r.procurement ? r.procurement.actualCost : r.estCost)}</span>
            <ReqBadge s={reqStatus(r)} />
          </div>
        </div>
      </Card>
    </button>
  );
}
