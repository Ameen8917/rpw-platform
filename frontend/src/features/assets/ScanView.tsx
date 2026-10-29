import { useState } from "react";
import {
  Search, UserCheck, Building2, MapPin, Calendar, CheckCircle2, Hash, Package, Layers,
} from "lucide-react";
import { Btn, Card, Empty, Field, PageHead, Row, SectionTitle } from "../../components/ui";
import { accessoryCode } from "../../domain/assets";
import { AssetBadge } from "./AssetBadges";
import { fmtDate } from "../../lib/format";
import { T } from "../../theme";

/* Scan a tag during physical audit — shows the asset plus everything issued with it */
export function ScanView({ ctx, assets }) {
  const { D, F, DEP, U, go } = ctx;
  const [q, setQ] = useState("");
  const [checked, setChecked] = useState({});
  const hit = assets.find((a) => a.code.toLowerCase() === q.trim().toLowerCase() || a.tagId === q.trim());
  const acc = hit?.accessories || [];

  return (
    <div className="space-y-4">
      <PageHead title="Scan asset" sub="Scan or type a tag to verify an asset during audit" />
      <Card>
        <Field label="Asset code or tag ID">
          <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: "1px solid " + T.line }}>
            <Search size={16} style={{ color: T.sub }} />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setChecked({}); }}
              placeholder="RPW/JNS/IT/26-27/0001 or 100011" className="w-full font-mono text-sm outline-none" />
          </div>
        </Field>
        <p className="mt-2 text-[11px]" style={{ color: T.sub }}>
          A handheld scanner types the code into this box automatically.
        </p>
      </Card>

      {q.trim() && !hit && <Card><Empty msg="No asset matches that code or tag ID." /></Card>}

      {hit && (
        <>
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold">{hit.name}</h2><AssetBadge s={hit.status} />
                </div>
                <div className="mt-1 font-mono text-[12px]" style={{ color: T.sub }}>{hit.code} · tag {hit.tagId}</div>
              </div>
              <Btn size="sm" kind="secondary" onClick={() => go("assetdetail", hit.id)}>Open record</Btn>
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
              <Row icon={Building2} k="Dealership" v={D(hit.dealershipId).name} />
              <Row icon={MapPin} k="Facility" v={hit.facilityId ? F(hit.facilityId).name : "—"} />
              <Row icon={Layers} k="Department" v={hit.deptId ? DEP(hit.deptId).name : "—"} />
              <Row icon={UserCheck} k="Issued to" v={hit.assignedTo ? `${U(hit.assignedTo).name} · ${U(hit.assignedTo).empCode}` : "Not issued to an individual"} />
              <Row icon={Hash} k="Serial" v={hit.serial} mono />
              <Row icon={Calendar} k="Purchased" v={fmtDate(hit.purchaseDate)} />
            </dl>
          </Card>

          <Card>
            <SectionTitle icon={Package}>Issued with this asset ({acc.length})</SectionTitle>
            {acc.length === 0 ? (
              <p className="mt-2 text-[13px]" style={{ color: T.sub }}>No bundled items recorded — the asset should be present on its own.</p>
            ) : (
              <>
                <p className="mt-1 text-[13px]" style={{ color: T.sub }}>Tick each item you can physically see.</p>
                <div className="mt-3 space-y-2">
                  {acc.map((x, i) => (
                    <button key={i} onClick={() => setChecked((c) => ({ ...c, [i]: !c[i] }))}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left"
                      style={{ background: checked[i] ? T.okBg : T.canvas }}>
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                        style={{ border: "1.5px solid " + (checked[i] ? T.ok : T.line), background: checked[i] ? T.ok : "#fff" }}>
                        {checked[i] && <CheckCircle2 size={13} color="#fff" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{x.name}</span>
                        <span className="block font-mono text-[11px]" style={{ color: T.sub }}>{accessoryCode(hit, i)}</span>
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-3 rounded-lg px-3 py-2 text-[12px]"
                  style={acc.every((_, i) => checked[i]) ? { background: T.okBg, color: T.ok } : { background: T.warnBg, color: T.warn }}>
                  {Object.values(checked).filter(Boolean).length} of {acc.length} verified
                  {acc.every((_, i) => checked[i]) ? " — complete" : " — remaining items not yet sighted"}
                </div>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
