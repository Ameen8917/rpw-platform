import { useState } from "react";
import {
  Search, Plus, ChevronRight, FileText,
} from "lucide-react";
import { Btn, Card, Empty, PageHead, Td, Th, inputStyle } from "../../components/ui";
import { depreciation } from "../../domain/assets";
import { AssetBadge, SourceTag } from "./AssetBadges";
import { LabelModal } from "./AssetLabel";
import { inrShort } from "../../lib/format";
import { T } from "../../theme";

export function AssetList({ ctx, assets }) {
  const { perm, D, F, go } = ctx;
  const [q, setQ] = useState(""); const [src, setSrc] = useState(""); const [dl, setDl] = useState("");
  const [labels, setLabels] = useState(null);
  const rows = assets.filter((a) =>
    (!q || (a.name + a.code + a.make).toLowerCase().includes(q.toLowerCase())) &&
    (!src || a.source === src) && (!dl || a.dealershipId === dl));
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PageHead title="Asset register" sub={`${rows.length} of ${assets.length}`} />
        <div className="hidden gap-2 md:flex">
          {rows.length > 0 && <Btn kind="secondary" icon={FileText} onClick={() => setLabels(rows)}>Print {rows.length} label{rows.length > 1 ? "s" : ""}</Btn>}
          {perm.canAddExisting && <Btn icon={Plus} onClick={() => go("newasset")}>Add existing asset</Btn>}
        </div>
      </div>
      <Card pad={false}>
        <div className="flex flex-col gap-2 p-3 md:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2" style={{ border: "1px solid " + T.line }}>
            <Search size={16} style={{ color: T.sub }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search assets…" className="w-full text-sm outline-none" />
          </div>
          <select value={dl} onChange={(e) => setDl(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
            <option value="">All dealerships</option>{ctx.dealerships.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select value={src} onChange={(e) => setSrc(e.target.value)} className="rounded-lg px-3 py-2 text-sm" style={inputStyle}>
            <option value="">All sources</option><option value="procured">Procured via app</option><option value="existing">Existing / opening stock</option>
          </select>
        </div>
      </Card>

      {rows.length === 0 ? <Card><Empty msg="No assets match." /></Card> : (
        <>
          <div className="space-y-2 md:hidden">
            {rows.map((a) => (
              <button key={a.id} onClick={() => go("assetdetail", a.id)} className="w-full text-left"><Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2"><span className="truncate text-sm font-semibold">{a.name}</span><AssetBadge s={a.status} /></div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-[11px]" style={{ color: T.sub }}>
                      <span className="font-mono">{a.code}</span><span>{D(a.dealershipId).name}</span>
                      <SourceTag s={a.source} />
                    </div>
                  </div>
                  <span className="shrink-0 text-sm font-semibold">{inrShort(a.cost)}</span>
                </div>
              </Card></button>
            ))}
          </div>
          <Card pad={false} className="hidden overflow-hidden md:block">
            <table className="w-full border-collapse text-sm">
              <thead><tr style={{ background: T.canvas, color: T.sub }}>
                <Th>Asset</Th><Th>Dealership</Th><Th>Location</Th><Th>Source</Th><Th>Status</Th><Th right>Cost</Th><Th right>Book value</Th><Th right />
              </tr></thead>
              <tbody>
                {rows.map((a, i) => (
                  <tr key={a.id} onClick={() => go("assetdetail", a.id)} className="cursor-pointer hover:bg-slate-50" style={{ borderTop: i ? "1px solid " + T.line : "none" }}>
                    <Td><div className="font-semibold">{a.name}</div><div className="font-mono text-[11px]" style={{ color: T.sub }}>{a.code}</div></Td>
                    <Td sub>{D(a.dealershipId).name}</Td>
                    <Td sub>{a.facilityId ? F(a.facilityId).name : "—"}</Td>
                    <Td><SourceTag s={a.source} /></Td>
                    <Td><AssetBadge s={a.status} /></Td>
                    <Td right><span className="font-semibold">{inrShort(a.cost)}</span></Td>
                    <Td right><span style={{ color: T.sub }}>{inrShort(depreciation(a)?.nbv ?? a.cost)}</span></Td>
                    <Td right><ChevronRight size={16} style={{ color: T.sub, display: "inline" }} /></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
      {perm.canAddExisting && (
        <button onClick={() => go("newasset")} className="fixed bottom-20 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg md:hidden" style={{ background: T.primary }}><Plus size={24} /></button>
      )}
      {labels && <LabelModal ctx={ctx} assets={labels} onClose={() => setLabels(null)} />}
    </div>
  );
}
