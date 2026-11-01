import { useState } from "react";
import {
  Boxes, Building2, Calendar, FileText, Landmark,
} from "lucide-react";
import { Card, Empty, PageHead, SectionTitle, Stat, inputStyle } from "../../components/ui";
import { reqStatus } from "../../domain/requisitions";
import { fmtDate, inrFull, inrShort, monthKey, monthLabel } from "../../lib/format";
import { T } from "../../theme";

export function Procurement({ ctx, reqs, assets }) {
  const { D, U, go, dealerships } = ctx;
  const [year, setYear] = useState("2026");
  const [dl, setDl] = useState("");
  const procured = reqs.filter((r) => reqStatus(r) === "procured" && r.procurement.at.startsWith(year) && (!dl || r.dealershipId === dl));
  const months = [...new Set<string>(procured.map((r) => monthKey(r.procurement.at)))].sort().reverse();
  const total = procured.reduce((s, r) => s + r.procurement.actualCost, 0);

  const byDealership = dealerships.map((d) => ({
    name: d.name,
    value: procured.filter((r) => r.dealershipId === d.id).reduce((s, r) => s + r.procurement.actualCost, 0),
  })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value);
  const maxD = Math.max(1, ...byDealership.map((x) => x.value));

  return (
    <div className="space-y-4">
      <PageHead title="Procurement" sub="Permanent record — by month, year and dealership" />

      <Card pad={false}>
        <div className="flex flex-col gap-2 p-3 md:flex-row">
          <select value={year} onChange={(e) => setYear(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
            <option value="2026">FY 2026</option><option value="2025">FY 2025</option>
          </select>
          <select value={dl} onChange={(e) => setDl(e.target.value)} className="flex-1 rounded-lg px-3 py-2 text-sm" style={inputStyle}>
            <option value="">All dealerships</option>{dealerships.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label={`Spend ${year}`} value={inrShort(total)} icon={Landmark} accent />
        <Stat label="Requisitions" value={String(procured.length)} icon={FileText} />
        <Stat label="Assets added" value={String(procured.reduce((s, r) => s + r.procurement.assetCodes.length, 0))} icon={Boxes} />
        <Stat label="Months active" value={String(months.length)} icon={Calendar} />
      </div>

      {byDealership.length > 0 && (
        <Card>
          <SectionTitle icon={Building2}>Spend by dealership — {year}</SectionTitle>
          <div className="mt-3 space-y-3">
            {byDealership.map((x) => (
              <div key={x.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-semibold">{x.name}</span><span style={{ color: T.sub }}>{inrShort(x.value)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: T.canvas }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(6, (x.value / maxD) * 100)}%`, background: T.primary }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {months.map((m) => {
        const inMonth = procured.filter((r) => monthKey(r.procurement.at) === m);
        const mTotal = inMonth.reduce((s, r) => s + r.procurement.actualCost, 0);
        return (
          <Card key={m}>
            <div className="flex items-center justify-between">
              <SectionTitle icon={Calendar}>{monthLabel(m)}</SectionTitle>
              <span className="text-sm font-semibold" style={{ color: T.primary }}>{inrFull(mTotal)}</span>
            </div>
            <div className="mt-3 space-y-2">
              {inMonth.map((r) => {
                const items = assets.filter((a) => r.procurement.assetCodes.includes(a.code));
                return (
                  <div key={r.id} className="rounded-lg p-3" style={{ background: T.canvas }}>
                    <button onClick={() => go("reqdetail", r.id)} className="flex w-full items-center justify-between text-left">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">{r.item}</div>
                        <div className="text-[11px]" style={{ color: T.sub }}>{r.ref} · {D(r.dealershipId).name} · procured by {U(r.procurement.by).name} on {fmtDate(r.procurement.at)}</div>
                      </div>
                      <span className="ml-2 shrink-0 text-sm font-semibold">{inrShort(r.procurement.actualCost)}</span>
                    </button>
                    <div className="mt-2 space-y-1">
                      {items.map((a) => (
                        <button key={a.id} onClick={() => go("assetdetail", a.id)} className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left hover:bg-white">
                          <span className="text-[12px]" style={{ color: T.sub }}>{a.name} <span className="font-mono">({a.code})</span></span>
                          <span className="text-[12px] font-semibold">{inrFull(a.cost)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
      {procured.length === 0 && <Card><Empty msg="No procurement recorded for this selection." /></Card>}
    </div>
  );
}
