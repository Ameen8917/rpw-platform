import { useState } from "react";
import {
  Boxes, ShieldCheck, Plus, ArrowRightLeft, UserCheck, Archive, Building2, MapPin, Calendar, FileText, CheckCircle2, Clock, Hash, Tag, Truck, ChevronLeft, TrendingUp, Package, Layers,
} from "lucide-react";
import { Barcode } from "../../components/Barcode";
import { Avatar, Btn, Card, Empty, MiniStat, Row, SectionTitle } from "../../components/ui";
import { CUSTODY_LABEL, accessoryCode, custodyState, depreciation } from "../../domain/assets";
import { LIMITS, RESIDUAL_PCT } from "../../domain/config";
import { AssetBadge, SourceTag } from "./AssetBadges";
import { LabelModal } from "./AssetLabel";
import { AcceptModal, AccessoryModal, DisposeModal, IssueModal, ReturnModal } from "./modals";
import { ApprovalBox } from "../requisitions/RequisitionBits";
import { fmtDate, inrFull, inrShort } from "../../lib/format";
import { T } from "../../theme";

/* Action handlers return a promise of success (the API call); dialogs close only when it succeeded */
export function AssetDetail({ ctx, a, reqs, auditLog, onDispose, onAddAccessory, onIssue, onReturn, onAccept }) {
  const { user, perm, D, F, DEP, U, go } = ctx;
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  if (!a) return <Empty msg="Asset not found." />;
  const req = a.reqRef ? reqs.find((r) => r.ref === a.reqRef) : null;
  /* Saved activity comes with the asset; requisition steps still recorded only in this browser are added */
  const history = [
    ...(a.activity || auditLog.filter((e) => e.ref === a.code)),
    ...auditLog.filter((e) => req && e.ref === req.ref && !(a.activity || []).some((x) => x.id === e.id)),
  ].sort((x, y) => (x.at < y.at ? 1 : -1));
  const submit = async (work: () => Promise<boolean> | boolean | void) => {
    setBusy(true);
    try {
      if ((await work()) !== false) setModal(null);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <button onClick={() => go("assets")} className="-ml-1 flex items-center gap-0.5 rounded px-1 text-[13px] font-medium hover:underline" style={{ color: T.sub }}><ChevronLeft size={15} />Assets</button>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-[24px] font-medium leading-tight">{a.name}</h1><AssetBadge s={a.status} /><SourceTag s={a.source} />
            </div>
            <div className="mt-1 text-sm" style={{ color: T.sub }}>{a.make} {a.model} · <span className="font-mono">{a.code}</span></div>
          </div>
          <div className="text-right">
            <div className="text-[11px]" style={{ color: T.sub }}>Purchase value</div>
            <div className="font-display text-[24px] font-normal leading-tight">{inrFull(a.cost)}</div>
          </div>
        </div>
        {perm.canDispose && a.status !== "disposed" && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Btn size="sm" kind="danger" icon={Archive} disabled={!!a.assignedTo} onClick={() => setModal("dispose")}>Dispose / write off</Btn>
            {a.assignedTo && <span className="text-[12px]" style={{ color: T.sub }}>Issued to someone — record its return first.</span>}
          </div>
        )}
        {a.disposal && (
          <div className="mt-4 rounded-lg p-3" style={{ background: T.badBg }}>
            <div className="text-xs font-semibold" style={{ color: T.bad }}>Written off on {fmtDate(a.disposal.at)} by {U(a.disposal.by)?.name || "—"}</div>
            <div className="mt-1 text-[12px]" style={{ color: T.ink }}>{a.disposal.reason}</div>
            <div className="mt-1 text-[11px]" style={{ color: T.sub }}>
              {a.disposal.bookValue !== null ? `Book value ${inrFull(Math.round(a.disposal.bookValue))}` : "No book value"}
              {a.disposal.scrapValue !== null ? ` · scrap value ${inrFull(a.disposal.scrapValue)}` : ""}
            </div>
          </div>
        )}
      </Card>

      <Card>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <Row icon={Tag} k="Category" v={a.category} />
          <Row icon={Building2} k="Dealership" v={D(a.dealershipId).name} />
          <Row icon={MapPin} k="Facility" v={a.facilityId ? `${F(a.facilityId).name} · ${F(a.facilityId).type}` : "—"} />
          <Row icon={Layers} k="Department" v={a.deptId ? DEP(a.deptId).name : "—"} />
          <Row icon={UserCheck} k="Issued to" v={a.assignedTo ? `${U(a.assignedTo).name} · ${U(a.assignedTo).empCode}` : "Not issued to an individual"} />
          <Row icon={Hash} k="Serial" v={a.serial} mono />
          <Row icon={Calendar} k="Purchased" v={fmtDate(a.purchaseDate)} />
          <Row icon={Truck} k="Vendor" v={a.vendor} />
          <Row icon={Clock} k="Warranty" v={a.warranty ? fmtDate(a.warranty) : "—"} />
        </dl>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle icon={Hash}>Asset tag</SectionTitle>
          <Btn size="sm" kind="secondary" icon={FileText} onClick={() => setModal("label")}>Print label</Btn>
        </div>
        <p className="mt-1 text-[13px]" style={{ color: T.sub }}>Scan during physical audit to pull up this record.</p>
        <div className="mt-3 flex justify-center rounded-lg p-3" style={{ background: "#fff", border: "1px solid " + T.line }}>
          <Barcode value={a.code} />
        </div>
        <div className="mt-2 text-center text-[11px]" style={{ color: T.sub }}>
          Short tag ID <span className="font-mono font-semibold" style={{ color: T.ink }}>{a.tagId}</span> — used on small tags where the full code will not fit
        </div>
      </Card>

      {(() => {
        const cs = custodyState(a);
        const holder = a.assignedTo ? U(a.assignedTo) : null;
        const isRecipient = a.assignedTo === user.id;
        return (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle icon={UserCheck}>Custody</SectionTitle>
              <span className="whitespace-nowrap rounded-[4px] px-2.5 py-0.5 text-[11px] font-medium" style={{ color: CUSTODY_LABEL[cs].c, background: CUSTODY_LABEL[cs].bg }}>
                {CUSTODY_LABEL[cs].label}
              </span>
            </div>

            {holder ? (
              <>
                <div className="mt-3 flex items-center gap-3">
                  <Avatar name={holder.name} size={34} />
                  <div>
                    <div className="text-sm font-semibold">{holder.name}</div>
                    <div className="text-[11px]" style={{ color: T.sub }}>{holder.empCode} · {holder.title}</div>
                  </div>
                </div>
                <div className="mt-2 text-[12px]" style={{ color: T.sub }}>
                  Issued by {a.issuedBy ? U(a.issuedBy)?.name : "—"}{a.issuedAt ? ` on ${fmtDate(a.issuedAt)}` : ""}
                </div>

                {a.acceptance ? (
                  <div className="mt-3 rounded-lg p-3" style={{ background: T.okBg }}>
                    <div className="text-xs font-semibold" style={{ color: T.ok }}>
                      Acknowledged {a.acceptance.method === "in_app" ? "in app" : "by signature"} on {fmtDate(a.acceptance.at)}
                    </div>
                    <div className="mt-1 text-[12px]" style={{ color: T.ink }}>
                      {a.acceptance.snapshot?.length} item{a.acceptance.snapshot?.length > 1 ? "s" : ""} acknowledged: {a.acceptance.snapshot?.join(", ")}
                    </div>
                    {a.acceptance.signature && (
                      <img src={a.acceptance.signature} alt="Signature" style={{ marginTop: 8, height: 54, background: "#fff", border: "1px solid " + T.line, borderRadius: 6 }} />
                    )}
                    {a.acceptance.note && <div className="mt-1 text-[11px]" style={{ color: T.sub }}>{a.acceptance.note}</div>}
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg p-3" style={{ background: T.badBg }}>
                    <div className="text-xs font-semibold" style={{ color: T.bad }}>Not yet acknowledged</div>
                    <div className="mt-1 text-[12px]" style={{ color: T.ink }}>
                      {holder.noLogin
                        ? "Recipient has no login — capture a signature at handover."
                        : `Waiting for ${holder.name} to confirm receipt from their own login.`}
                    </div>
                    {isRecipient && (
                      <div className="mt-2"><Btn size="sm" icon={CheckCircle2} onClick={() => setModal("accept")}>Accept this asset</Btn></div>
                    )}
                  </div>
                )}

              </>
            ) : (
              <p className="mt-2 text-[13px]" style={{ color: T.sub }}>Not issued to an individual — held by the facility or department.</p>
            )}

            {a.returnRecord && (
              <div className="mt-2 rounded-lg p-3" style={{ background: T.slateBg }}>
                <div className="text-xs font-semibold" style={{ color: T.sub }}>
                  Last returned on {fmtDate(a.returnRecord.at)}{a.returnRecord.from ? ` by ${U(a.returnRecord.from)?.name}` : ""} · condition: {a.returnRecord.condition}
                </div>
                {a.returnRecord.missing?.length > 0 && (
                  <div className="mt-1 text-[12px]" style={{ color: T.bad }}>Not returned: {a.returnRecord.missing.join(", ")}</div>
                )}
                {a.returnRecord.signature && (
                  <img src={a.returnRecord.signature} alt="Signature of the person returning" style={{ marginTop: 8, height: 54, background: "#fff", border: "1px solid " + T.line, borderRadius: 6 }} />
                )}
              </div>
            )}

            {perm.canAddExisting && a.status !== "disposed" && (
              <div className="mt-3 flex flex-wrap gap-2">
                {!holder && <Btn size="sm" kind="secondary" icon={UserCheck} onClick={() => setModal("issue")}>Issue to employee</Btn>}
                {holder && <Btn size="sm" kind="secondary" icon={ArrowRightLeft} onClick={() => setModal("return")}>Record return</Btn>}
              </div>
            )}
          </Card>
        );
      })()}

      {(() => {
        const acc = a.accessories || [];
        const separate = acc.filter((x) => x.origin === "separate");
        const sepCost = separate.reduce((s2, x) => s2 + (x.cost || 0), 0);
        return (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle icon={Package}>Accessories ({acc.length})</SectionTitle>
              {perm.canAddExisting && a.status !== "disposed" && <Btn size="sm" kind="secondary" icon={Plus} onClick={() => setModal("accessory")}>Add accessory</Btn>}
            </div>
            <p className="mt-1 text-[13px]" style={{ color: T.sub }}>
              Tracked against this asset, not capitalised on their own. Bundled items are already inside the asset cost.
            </p>
            {acc.length === 0 ? <Empty msg="No accessories recorded." /> : (
              <div className="mt-3 space-y-2">
                {acc.map((x, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 rounded-lg px-3 py-2.5" style={{ background: T.canvas }}>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{x.name}</div>
                      <div className="font-mono text-[11px]" style={{ color: T.sub }}>{accessoryCode(a, i)}</div>
                      <div className="text-[11px]" style={{ color: T.sub }}>
                        {x.origin === "bundled" ? "Came with the asset" : `Bought separately · ${fmtDate(x.addedAt)}`}
                        {x.serial && x.serial !== "—" ? ` · ${x.serial}` : ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {x.origin === "bundled"
                        ? <span className="whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium" style={{ color: T.sub, background: T.slateBg }}>In asset cost</span>
                        : <>
                            <div className="text-sm font-semibold">{inrFull(x.cost || 0)}</div>
                            <span className="whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium" style={{ color: T.warn, background: T.warnBg }}>Expensed</span>
                          </>}
                    </div>
                  </div>
                ))}
                {separate.length > 0 && (
                  <div className="flex justify-between px-3 pt-1 text-[12px]" style={{ color: T.sub }}>
                    <span>{separate.length} bought separately, below the {inrShort(LIMITS.capitalisation)} capitalisation floor</span>
                    <span className="font-semibold">{inrFull(sepCost)} expensed</span>
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })()}

      {(() => {
        const dep = a.depreciation !== undefined ? a.depreciation : depreciation(a);
        if (!dep) return null;
        const pct = (dep.accumulated / a.cost) * 100;
        return (
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <SectionTitle icon={TrendingUp}>Depreciation</SectionTitle>
              <span className="text-[11px]" style={{ color: T.sub }}>Companies Act 2013, Schedule II · WDV · {RESIDUAL_PCT}% residual</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <MiniStat label="Original cost" value={inrShort(a.cost)} />
              <MiniStat label="Accumulated dep." value={inrShort(dep.accumulated)} />
              <MiniStat label="Net book value" value={inrShort(dep.nbv)} />
              <MiniStat label="Useful life" value={`${dep.life} yrs`} />
            </div>
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[11px]" style={{ color: T.sub }}>
                <span>{dep.years.toFixed(1)} of {dep.life} years elapsed</span>
                <span>{pct.toFixed(0)}% depreciated at {dep.rate.toFixed(1)}% p.a.</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: T.canvas }}>
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: dep.fullyDepreciated ? T.warn : T.primary }} />
              </div>
            </div>
            {dep.fullyDepreciated && (
              <div className="mt-3 rounded-lg px-3 py-2 text-[12px]" style={{ background: T.warnBg, color: T.warn }}>
                Useful life complete — carried at residual value. Consider review for disposal.
              </div>
            )}
            <p className="mt-3 text-[11px]" style={{ color: T.sub }}>
              Book value for statutory accounts. Income-tax depreciation is computed separately on a block-of-assets basis and will differ.
            </p>
          </Card>
        );
      })()}

      {req ? (
        <Card>
          <SectionTitle icon={FileText}>Procurement trail</SectionTitle>
          <p className="mt-1 text-[13px]" style={{ color: T.sub }}>This asset came from requisition {req.ref}.</p>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <ApprovalBox label={D(req.dealershipId).isCorporate ? "Director" : "Business Head"} person={U(req.bh.by)} slot={req.bh} U={U} />
            <ApprovalBox label={`${DEP(req.deptId).name} Head`} person={U(req.fn.by)} slot={req.fn} U={U} />
          </div>
          <div className="mt-3"><Btn kind="secondary" size="sm" onClick={() => go("reqdetail", req.id)}>Open requisition</Btn></div>
        </Card>
      ) : (
        <Card>
          <SectionTitle icon={Boxes}>Opening stock</SectionTitle>
          <p className="mt-1 text-[13px]" style={{ color: T.sub }}>Entered directly into the register — no requisition trail, as it pre-dates the platform.</p>
        </Card>
      )}

      {history.length > 0 && (
        <Card>
          <SectionTitle icon={ShieldCheck}>Activity</SectionTitle>
          <ol className="mt-3 space-y-3 pl-5">
            {history.map((e) => (
              <li key={e.id} className="relative">
                <span className="absolute -left-5 top-1.5 h-2 w-2 rounded-full" style={{ background: T.primary }} />
                <div className="text-sm font-semibold">{e.action}</div>
                <div className="text-[13px]" style={{ color: T.sub }}>{e.detail}</div>
                <div className="text-[11px]" style={{ color: T.sub }}>{U(e.actorId)?.name} · {fmtDate(e.at)}</div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {modal === "label" && <LabelModal ctx={ctx} assets={[a]} onClose={() => setModal(null)} />}
      {modal === "issue" && <IssueModal a={a} ctx={ctx} busy={busy} onClose={() => setModal(null)}
        onSubmit={(d) => submit(() => onIssue(d))} />}
      {modal === "return" && <ReturnModal a={a} ctx={ctx} busy={busy} onClose={() => setModal(null)}
        onSubmit={(d) => submit(() => onReturn(d))} />}
      {modal === "accept" && <AcceptModal a={a} busy={busy} onClose={() => setModal(null)}
        onSubmit={() => submit(() => onAccept())} />}
      {modal === "accessory" && <AccessoryModal a={a} busy={busy} onClose={() => setModal(null)}
        onSubmit={(acc) => submit(() => onAddAccessory(acc))} />}
      {modal === "dispose" && <DisposeModal a={a} busy={busy} onClose={() => setModal(null)} onSubmit={(r2, s) => submit(() => onDispose(r2, s))} />}
    </div>
  );
}
