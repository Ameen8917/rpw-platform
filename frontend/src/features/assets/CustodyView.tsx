import { useState } from "react";
import {
  Boxes, AlertTriangle, Package, Users,
} from "lucide-react";
import { Avatar, Card, Empty, PageHead, Stat, inputStyle } from "../../components/ui";
import { CUSTODY_LABEL, custodyState } from "../../domain/assets";
import { inrShort } from "../../lib/format";
import { T } from "../../theme";

/* Who is holding what — custody register, and the basis of an exit checklist */
export function CustodyView({ ctx, assets }) {
  const { perm, user, users, D, DEP, go } = ctx;
  const [dl, setDl] = useState(""); const [dept, setDept] = useState(""); const [who, setWho] = useState(""); const [loc, setLoc] = useState("");
  const issued = assets.filter((a) => a.assignedTo && a.status !== "disposed");
  const scoped = perm.isBH ? issued.filter((a) => user.dealershipIds.includes(a.dealershipId)) : issued;
  const rows = scoped.filter((a) => (!dl || a.dealershipId === dl) && (!dept || a.deptId === dept)
    && (!who || a.assignedTo === who) && (!loc || a.facilityId === loc));

  const byPerson = {};
  rows.forEach((a) => { (byPerson[a.assignedTo] = byPerson[a.assignedTo] || []).push(a); });
  const people = Object.keys(byPerson).sort((x, y) => byPerson[y].length - byPerson[x].length);
  const totalItems = rows.reduce((s2, a) => s2 + 1 + (a.accessories?.length || 0), 0);

  return (
    <div className="space-y-4">
      <PageHead title="Asset custody" sub="Who is personally holding what — across dealerships and departments" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="People holding assets" value={String(people.length)} icon={Users} />
        <Stat label="Assets issued" value={String(rows.length)} icon={Boxes} accent />
        <Stat label="Items incl. bundled" value={String(totalItems)} icon={Package} />
        <Stat label="Acceptance pending" value={String(rows.filter((a) => custodyState(a) === "pending").length)} icon={AlertTriangle}
          tone={rows.some((a) => custodyState(a) === "pending") ? "bad" : undefined} />
      </div>

      <Card pad={false}>
        <div className="flex flex-col gap-2 p-3 md:flex-row">
          <select value={dl} onChange={(e) => setDl(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
            <option value="">All dealerships</option>{ctx.dealerships.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={dept} onChange={(e) => setDept(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
            <option value="">All departments</option>{ctx.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={loc} onChange={(e) => setLoc(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
            <option value="">All locations</option>
            {ctx.facilities.filter((x) => !dl || x.dealershipId === dl).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <select value={who} onChange={(e) => setWho(e.target.value)} className="flex-1 rounded-lg px-3 py-2 text-sm" style={inputStyle}>
            <option value="">All employees</option>{users.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.empCode}</option>)}
          </select>
        </div>
      </Card>

      {people.length === 0 ? <Card><Empty msg="No assets issued to individuals for this selection." /></Card> : people.map((pid) => {
        const u = users.find((x) => x.id === pid);
        const items = byPerson[pid];
        const accCount = items.reduce((s2, a) => s2 + (a.accessories?.length || 0), 0);
        return (
          <Card key={pid}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={u?.name || "?"} size={36} />
                <div>
                  <div className="text-sm font-semibold">{u?.name}</div>
                  <div className="text-[11px]" style={{ color: T.sub }}>
                    {u?.empCode} · {u?.title}<br />{D(u?.dealershipIds?.[0])?.name}{u?.facilityId ? ` · ${ctx.F(u.facilityId)?.name}` : ""}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold">{items.length} asset{items.length > 1 ? "s" : ""}{accCount ? ` + ${accCount} item${accCount > 1 ? "s" : ""}` : ""}</div>
                <div className="text-[11px]" style={{ color: T.sub }}>{inrShort(items.reduce((s2, a) => s2 + a.cost, 0))} value</div>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {items.map((a) => (
                <div key={a.id} className="rounded-lg px-3 py-2.5" style={{ background: T.canvas }}>
                  <button onClick={() => go("assetdetail", a.id)} className="flex w-full items-start justify-between gap-3 text-left">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{a.name}</div>
                      <div className="font-mono text-[11px]" style={{ color: T.sub }}>{a.code}</div>
                    </div>
                    <span className="shrink-0 text-right text-[11px]" style={{ color: T.sub }}>
                      {a.deptId ? DEP(a.deptId).name : "—"}{a.facilityId ? <><br />{ctx.F(a.facilityId)?.name}</> : null}
                    </span>
                  </button>
                  <div className="mt-1">
                    <span className="whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium"
                      style={{ color: CUSTODY_LABEL[custodyState(a)].c, background: CUSTODY_LABEL[custodyState(a)].bg }}>
                      {CUSTODY_LABEL[custodyState(a)].label}
                    </span>
                  </div>
                  {(a.accessories || []).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {a.accessories.map((x, i) => (
                        <span key={i} className="whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium" style={{ color: T.sub, background: T.slateBg }}>{x.name}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {who === pid && (
              <div className="mt-3 rounded-lg px-3 py-2 text-[12px]" style={{ background: T.warnBg, color: T.warn }}>
                Exit checklist — {items.length + accCount} item{items.length + accCount > 1 ? "s" : ""} to recover from {u?.name} before clearance.
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
