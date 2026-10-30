import { useState } from "react";
import {
  Plus, ChevronLeft,
} from "lucide-react";
import { EmployeePicker } from "../../components/EmployeePicker";
import { Btn, Card, Field, PageHead, inputCls, inputStyle } from "../../components/ui";
import { CATEGORIES, CATEGORY_META, genAssetCode, parseBundled } from "../../domain/assets";
import { InvoiceScanner } from "../invoices/InvoiceScanner";
import { TODAY, cx } from "../../lib/format";
import { T } from "../../theme";
import type { AssetCategory } from "../../types";

export function NewExistingAsset({ ctx, onCancel, onCreate }) {
  const { dealerships, facilities, departments } = ctx;
  const [f, setF] = useState({ name: "", category: CATEGORIES[0], make: "", model: "", serial: "", purchaseDate: "", cost: "", vendor: "", dealershipId: dealerships[0].id, facilityId: "", deptId: "", warranty: "", bundled: "", assignedTo: "" });
  const fac = facilities.filter((x) => x.dealershipId === f.dealershipId && x.active);
  const [filled, setFilled] = useState({});   /* which fields came from the invoice */
  const [invoiceDoc, setInvoiceDoc] = useState(null);
  const [busy, setBusy] = useState(false);
  /* The server numbers the code when it saves; the form shows the prefix it will use */
  const code = genAssetCode([], dealerships, f.dealershipId, f.category, f.purchaseDate || TODAY.toISOString()).replace(/d{4}$/, "····");
  const life = CATEGORY_META[f.category]?.life;
  const ok = f.name.trim() && f.cost;

  /* Apply one extracted line item, leaving anything it could not read blank */
  function applyItem(it, meta) {
    const next = { ...f };
    const marks = {};
    const put = (k, v) => { if (v !== null && v !== undefined && v !== "") { next[k] = v; marks[k] = true; } };
    put("name", it.name);
    put("make", it.make);
    put("model", it.model);
    put("serial", it.serial);
    if (it.category && CATEGORIES.includes(it.category)) put("category", it.category);
    if (it.unitCost != null) put("cost", String(Math.round(it.unitCost)));
    put("vendor", meta?.vendor);
    put("purchaseDate", meta?.invoiceDate);
    if (it.warrantyMonths && meta?.invoiceDate) {
      const d = new Date(meta.invoiceDate);
      d.setMonth(d.getMonth() + Number(it.warrantyMonths));
      put("warranty", d.toISOString().slice(0, 10));
    }
    if (Array.isArray(it.bundled) && it.bundled.length) put("bundled", it.bundled.join(", "));
    setF(next); setFilled(marks); setInvoiceDoc(meta || null);
  }
  const FromInvoice = ({ k }) => filled[k]
    ? <span className="ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ color: T.primary, background: T.primarySoft }}>from invoice</span>
    : null;
  return (
    <div className="space-y-4">
      <button onClick={onCancel} className="flex items-center gap-1 text-sm font-semibold" style={{ color: T.primary }}><ChevronLeft size={16} />Assets</button>
      <PageHead title="Add existing asset" sub="Opening stock — already owned, not procured through the platform" />

      <InvoiceScanner onFill={applyItem} onAttach={setInvoiceDoc} />

      <Card>
        <div className="mb-3 rounded-lg px-3 py-2 text-[12px]" style={{ background: T.slateBg, color: T.sub }}>
          Tagged “opening stock”, so it stays out of procurement spend reports. Code is generated automatically — {life ? `${f.category} depreciates over ${life} years under Schedule II.` : ""}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Asset code (numbered on save)">
            <div className={inputCls} style={{ ...inputStyle, background: T.canvas, color: T.sub }}><span className="font-mono">{code}</span></div>
          </Field>
          <Field label="Category"><select className={inputCls} style={inputStyle} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value as AssetCategory })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label={<>Name<FromInvoice k="name" /></>}><input className={inputCls} style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
          <Field label={<>Make<FromInvoice k="make" /></>}><input className={inputCls} style={inputStyle} value={f.make} onChange={(e) => setF({ ...f, make: e.target.value })} /></Field>
          <Field label={<>Model<FromInvoice k="model" /></>}><input className={inputCls} style={inputStyle} value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></Field>
          <Field label={<>Serial<FromInvoice k="serial" /></>}><input className={inputCls} style={inputStyle} value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} /></Field>
          <Field label="Dealership"><select className={inputCls} style={inputStyle} value={f.dealershipId} onChange={(e) => setF({ ...f, dealershipId: e.target.value, facilityId: "" })}>{dealerships.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Location — showroom / workshop / outlet">
            <select className={inputCls} style={inputStyle} value={f.facilityId} onChange={(e) => setF({ ...f, facilityId: e.target.value })}>
              <option value="">— not specified —</option>
              {fac.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.type}</option>)}
            </select>
          </Field>
          <Field label="Department"><select className={inputCls} style={inputStyle} value={f.deptId} onChange={(e) => setF({ ...f, deptId: e.target.value })}><option value="">—</option>{departments.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label={<>Purchase date<FromInvoice k="purchaseDate" /></>}><input type="date" className={inputCls} style={inputStyle} value={f.purchaseDate} onChange={(e) => setF({ ...f, purchaseDate: e.target.value })} /></Field>
          <Field label={<>Purchase cost (₹)<FromInvoice k="cost" /></>}><input type="number" className={inputCls} style={inputStyle} value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} /></Field>
          <Field label={<>Vendor<FromInvoice k="vendor" /></>}><input className={inputCls} style={inputStyle} value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} /></Field>
          <Field label={<>Warranty till<FromInvoice k="warranty" /></>}><input type="date" className={inputCls} style={inputStyle} value={f.warranty} onChange={(e) => setF({ ...f, warranty: e.target.value })} /></Field>
        </div>

        <div className="mt-4 rounded-lg p-3" style={{ background: T.canvas }}>
          <div className="text-sm font-semibold">Bundled items <span className="font-normal" style={{ color: T.sub }}>— optional</span></div>
          <p className="mt-0.5 text-[12px]" style={{ color: T.sub }}>
            Items issued with the asset that are not assets themselves. Separate with commas. They appear on the asset and when the tag is scanned.
          </p>
          <input className={cx(inputCls, "mt-2")} style={inputStyle} value={f.bundled}
            onChange={(e) => setF({ ...f, bundled: e.target.value })} placeholder="Charger, Screen guard, Phone cover" />
          {f.bundled.trim() && (
            <div className="mt-2 flex flex-wrap gap-1">
              {parseBundled(f.bundled, "").map((b, i) => (
                <span key={i} className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ color: T.primary, background: T.primarySoft }}>{b.name}</span>
              ))}
            </div>
          )}
        </div>

        <div className="mt-3 rounded-lg p-3" style={{ background: T.canvas }}>
          <div className="text-sm font-semibold">Issued to <span className="font-normal" style={{ color: T.sub }}>— optional</span></div>
          <p className="mt-0.5 text-[12px]" style={{ color: T.sub }}>
            Leave blank for a shared or facility asset. Naming a person makes it their individual responsibility and puts it on their exit checklist.
          </p>
          <div className="mt-2"><EmployeePicker users={ctx.users} dealershipId={f.dealershipId} value={f.assignedTo}
            onChange={(v) => {
              const emp = ctx.users.find((u) => u.id === v);
              setF((prev) => ({ ...prev, assignedTo: v, facilityId: prev.facilityId || emp?.facilityId || "" }));
            }} facilityName={(id) => ctx.F(id)?.name} /></div>
          {f.assignedTo && ctx.users.find((u) => u.id === f.assignedTo)?.facilityId && (
            <p className="mt-1 text-[11px]" style={{ color: T.sub }}>
              Location set to {ctx.F(ctx.users.find((u) => u.id === f.assignedTo).facilityId)?.name} — change above if the asset sits elsewhere.
            </p>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <Btn kind="ghost" onClick={onCancel}>Cancel</Btn>
          <Btn icon={Plus} disabled={!ok || busy} onClick={async () => {
            setBusy(true);
            try {
              await onCreate({ ...f, assignedTo: f.assignedTo || null, invoiceDoc });
            } finally {
              setBusy(false);
            }
          }}>{busy ? "Saving…" : "Add to register"}</Btn>
        </div>
      </Card>
    </div>
  );
}
