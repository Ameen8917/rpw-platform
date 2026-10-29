import { useState } from "react";
import {
  Plus, ChevronLeft,
} from "lucide-react";
import { Btn, Card, Field, PageHead, inputCls, inputStyle } from "../../components/ui";
import { LIMITS } from "../../domain/config";
import { inrShort } from "../../lib/format";
import { T } from "../../theme";

export function NewReq({ ctx, onCancel, onCreate }) {
  const { user, dealerships, facilities, departments, DEP } = ctx;
  const myD = user.role === "functional_head" ? dealerships.filter((d) => d.active) : dealerships.filter((d) => user.dealershipIds.includes(d.id));
  const [f, setF] = useState({ dealershipId: myD[0].id, facilityId: "", deptId: user.deptId || "DEP_IT", item: "", qty: 1, estCost: "", justification: "", expectedDelivery: "", advReq: false, advAmount: "", advTerms: "" });
  const fac = facilities.filter((x) => x.dealershipId === f.dealershipId && x.active);
  const dep = DEP(f.deptId);
  const ok = f.item.trim() && f.estCost && f.justification.trim();
  return (
    <div className="space-y-4">
      <button onClick={onCancel} className="flex items-center gap-1 text-sm font-semibold" style={{ color: T.primary }}><ChevronLeft size={16} />Requisitions</button>
      <PageHead title="Raise a requisition" sub="Goes to your Business Head and functional head for approval" />
      <Card>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Dealership"><select className={inputCls} style={inputStyle} value={f.dealershipId} onChange={(e) => setF({ ...f, dealershipId: e.target.value, facilityId: "" })}>
            {myD.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Facility / outlet"><select className={inputCls} style={inputStyle} value={f.facilityId} onChange={(e) => setF({ ...f, facilityId: e.target.value })}>
            <option value="">— not specified —</option>{fac.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.type}</option>)}</select></Field>
          <Field label="Department"><select className={inputCls} style={inputStyle} value={f.deptId} onChange={(e) => setF({ ...f, deptId: e.target.value })}>
            {departments.filter((d) => d.dualAuthority && d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Quantity"><input type="number" className={inputCls} style={inputStyle} value={f.qty} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} /></Field>
          <div className="sm:col-span-2"><Field label="What is needed?"><input className={inputCls} style={inputStyle} value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} placeholder="e.g. 2 desktop PCs for back office" /></Field></div>
          <Field label="Estimated cost (₹)"><input type="number" className={inputCls} style={inputStyle} value={f.estCost} onChange={(e) => setF({ ...f, estCost: e.target.value })} /></Field>
          <Field label="Expected delivery"><input type="date" className={inputCls} style={inputStyle} value={f.expectedDelivery} onChange={(e) => setF({ ...f, expectedDelivery: e.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Justification"><textarea rows={3} className={inputCls} style={inputStyle} value={f.justification} onChange={(e) => setF({ ...f, justification: e.target.value })} /></Field></div>
        </div>

        <div className="mt-4 rounded-lg p-3" style={{ background: T.canvas }}>
          <label className="flex cursor-pointer items-start gap-2">
            <input type="checkbox" className="mt-1" checked={f.advReq} onChange={(e) => setF({ ...f, advReq: e.target.checked })} />
            <span>
              <span className="text-sm font-semibold">Vendor requires an advance payment</span>
              <span className="block text-[12px]" style={{ color: T.sub }}>Accounts will see this and release the advance once both approvals are in.</span>
            </span>
          </label>
          {f.advReq && (
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Advance amount (₹)"><input type="number" className={inputCls} style={inputStyle} value={f.advAmount} onChange={(e) => setF({ ...f, advAmount: e.target.value })} placeholder="30000" /></Field>
              <Field label="Payment terms"><input className={inputCls} style={inputStyle} value={f.advTerms} onChange={(e) => setF({ ...f, advTerms: e.target.value })} placeholder="e.g. 30% against PO, balance on delivery" /></Field>
            </div>
          )}
        </div>

        <div className="mt-3 rounded-lg px-3 py-2 text-[12px]" style={{ background: T.primarySoft, color: T.primaryDark }}>
          Requires approval from the Business Head and {dep.name} Head before procurement.
          {Number(f.estCost) > LIMITS.purchaseDirector && f.dealershipId !== "D_CORP"
            ? ` Estimate over ${inrShort(LIMITS.purchaseDirector)} — Director approval also required.`
            : ""}
          {f.advReq && Number(f.advAmount) > LIMITS.advanceEscalation
            ? ` Advance over ${inrShort(LIMITS.advanceEscalation)} — also needs GM Finance and Director approval.`
            : f.advReq ? " Advance approved by the Accounts Manager, then paid by Accounts." : ""}
        </div>
        <div className="mt-4 flex gap-2">
          <Btn kind="ghost" onClick={onCancel}>Cancel</Btn>
          <Btn icon={Plus} disabled={!ok || (f.advReq && !f.advAmount)} onClick={() => onCreate({
            dealershipId: f.dealershipId, facilityId: f.facilityId, deptId: f.deptId, item: f.item, qty: f.qty,
            estCost: Number(f.estCost), justification: f.justification, expectedDelivery: f.expectedDelivery,
            advance: { required: f.advReq, amount: Number(f.advAmount) || 0, terms: f.advTerms },
            payments: { advance: null, balance: null },
          })}>Raise requisition</Btn>
        </div>
      </Card>
    </div>
  );
}
