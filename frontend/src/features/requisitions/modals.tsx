import { useState } from "react";
import {
  Plus, X,
} from "lucide-react";
import { EmployeePicker } from "../../components/EmployeePicker";
import { Btn, Field, Modal, inputCls, inputStyle } from "../../components/ui";
import { CATEGORIES } from "../../domain/assets";
import { InvoiceUpload } from "../invoices/InvoiceScanner";
import { expandQuantities } from "../invoices/invoiceReader";
import { inrFull } from "../../lib/format";
import { T } from "../../theme";

export function DecisionModal({ title, decision, onClose, onSubmit }) {
  const [note, setNote] = useState("");
  return (
    <Modal title={title} onClose={onClose}
      footer={<><Btn kind="ghost" full onClick={onClose}>Cancel</Btn>
        <Btn kind={decision === "rejected" ? "danger" : "primary"} full disabled={decision === "rejected" && !note.trim()} onClick={() => onSubmit(note)}>
          {decision === "rejected" ? "Reject" : "Approve"}</Btn></>}>
      <Field label={decision === "rejected" ? "Reason (required)" : "Note (optional)"}>
        <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={inputCls} style={inputStyle} />
      </Field>
    </Modal>
  );
}

export function ProcureModal({ r, ctx, onClose, onSubmit }) {
  const [vendor, setVendor] = useState(""); const [invoice, setInvoice] = useState("");
  const [date, setDate] = useState("2026-09-06");
  const [invoiceDoc, setInvoiceDoc] = useState(null);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([{ name: "", category: CATEGORIES[0], make: "", model: "", serial: "", cost: "", warranty: "", bundled: "", assignedTo: "", fromInvoice: false }]);
  const set = (i, k, v) => setRows((rs) => rs.map((r2, j) => j === i ? { ...r2, [k]: v } : r2));
  const total = rows.reduce((s, x) => s + (Number(x.cost) || 0), 0);
  const ok = vendor.trim() && rows.every((x) => x.name.trim() && x.cost);
  return (
    <Modal title="Record procurement" onClose={onClose}
      footer={<><Btn kind="ghost" full onClick={onClose}>Cancel</Btn><Btn full disabled={!ok || busy} onClick={async () => {
        setBusy(true);
        try { await onSubmit({ vendor, invoice, date, assets: rows, invoiceDoc }); } finally { setBusy(false); }
      }}>{busy ? "Saving…" : "Procure & add to register"}</Btn></>}>
      <div className="space-y-3">
        <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: T.primarySoft, color: T.primaryDark }}>
          Estimated {inrFull(r.estCost)} · each line below becomes an asset in the register.
          <div className="mt-1">Bundled items like chargers or cables should not be listed separately — add them as accessories on the asset once created.</div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Vendor"><input className={inputCls} style={inputStyle} value={vendor} onChange={(e) => setVendor(e.target.value)} /></Field>
          <Field label="Invoice no."><input className={inputCls} style={inputStyle} value={invoice} onChange={(e) => setInvoice(e.target.value)} /></Field>
        </div>
        <Field label="Purchase date"><input type="date" className={inputCls} style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} /></Field>

        <InvoiceUpload r={r} onExtract={(d) => {
          setInvoiceDoc(d);
          if (d.vendor && !vendor) setVendor(d.vendor);
          if (d.invoiceNo && !invoice) setInvoice(d.invoiceNo);
          if (d.invoiceDate) setDate(d.invoiceDate);
          /* Each unit on the invoice becomes an asset entry, ready to check and adjust */
          if (Array.isArray(d.items) && d.items.length) {
            setRows(expandQuantities(d.items).map((it) => {
              let warranty = "";
              if (it.warrantyMonths && d.invoiceDate) {
                const w = new Date(d.invoiceDate);
                w.setMonth(w.getMonth() + Number(it.warrantyMonths));
                warranty = w.toISOString().slice(0, 10);
              }
              return {
                name: it.name || "",
                category: CATEGORIES.includes(it.category) ? it.category : CATEGORIES[0],
                make: it.make || "", model: it.model || "", serial: it.serial || "",
                cost: it.unitCost != null ? String(Math.round(it.unitCost)) : "",
                warranty,
                bundled: Array.isArray(it.bundled) ? it.bundled.join(", ") : "",
                assignedTo: "",
                fromInvoice: true,
              };
            }));
          }
        }} />

        {invoiceDoc?.total != null && Math.abs(total - invoiceDoc.total) > 1 && total > 0 && (
          <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: T.warnBg, color: T.warn }}>
            Asset lines below add up to {inrFull(total)}, but the invoice total is {inrFull(invoiceDoc.total)}. Adjust the line costs so the register matches the invoice.
          </div>
        )}
        {rows.map((x, i) => (
          <div key={i} className="rounded-lg p-3" style={{ background: T.canvas }}>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: T.sub }}>
                Asset {i + 1}
                {x.fromInvoice && <span className="ml-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold" style={{ color: T.primary, background: T.primarySoft }}>from invoice</span>}
              </span>
              {rows.length > 1 && <button onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} style={{ color: T.bad }}><X size={14} /></button>}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="col-span-2"><Field label="Name"><input className={inputCls} style={inputStyle} value={x.name} onChange={(e) => set(i, "name", e.target.value)} /></Field></div>
              <Field label="Category"><select className={inputCls} style={inputStyle} value={x.category} onChange={(e) => set(i, "category", e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Cost (₹)"><input type="number" className={inputCls} style={inputStyle} value={x.cost} onChange={(e) => set(i, "cost", e.target.value)} /></Field>
              <Field label="Make"><input className={inputCls} style={inputStyle} value={x.make} onChange={(e) => set(i, "make", e.target.value)} /></Field>
              <Field label="Model"><input className={inputCls} style={inputStyle} value={x.model} onChange={(e) => set(i, "model", e.target.value)} /></Field>
              <Field label="Serial"><input className={inputCls} style={inputStyle} value={x.serial} onChange={(e) => set(i, "serial", e.target.value)} /></Field>
              <Field label="Warranty till"><input type="date" className={inputCls} style={inputStyle} value={x.warranty} onChange={(e) => set(i, "warranty", e.target.value)} /></Field>
              <div className="col-span-2"><Field label="Bundled items (optional, comma separated)">
                <input className={inputCls} style={inputStyle} value={x.bundled} onChange={(e) => set(i, "bundled", e.target.value)} placeholder="Charger, Screen guard, Cover" />
              </Field></div>
              <div className="col-span-2"><Field label="Issue to employee (optional)">
                <EmployeePicker users={ctx.users} dealershipId={r.dealershipId} value={x.assignedTo} onChange={(v) => set(i, "assignedTo", v)} facilityName={(id) => ctx.F(id)?.name} />
              </Field></div>
            </div>
          </div>
        ))}
        <Btn kind="secondary" size="sm" icon={Plus} onClick={() => setRows((rs) => [...rs, { name: "", category: CATEGORIES[0], make: "", model: "", serial: "", cost: "", warranty: "", bundled: "", assignedTo: "", fromInvoice: false }])}>Add another asset</Btn>
        <div className="flex items-center justify-between pt-2 text-sm font-bold" style={{ borderTop: "1px solid " + T.line }}>
          <span>Total</span><span style={{ color: T.primary }}>{inrFull(total)}</span>
        </div>
      </div>
    </Modal>
  );
}

export function ResubmitModal({ r, ctx, onClose, onSubmit }) {
  const [f, setF] = useState({ item: r.item, qty: r.qty, estCost: String(r.estCost), justification: r.justification, expectedDelivery: r.expectedDelivery || "" });
  const rejectedBy = r.bh.decision === "rejected" ? r.bh : r.fn;
  const ok = f.item.trim() && f.estCost && f.justification.trim();
  return (
    <Modal title="Revise & resubmit" onClose={onClose}
      footer={<><Btn kind="ghost" full onClick={onClose}>Cancel</Btn><Btn full disabled={!ok} onClick={() => onSubmit({
        dealershipId: r.dealershipId, facilityId: r.facilityId, deptId: r.deptId,
        item: f.item, qty: Number(f.qty), estCost: Number(f.estCost), justification: f.justification,
        expectedDelivery: f.expectedDelivery,
      })}>Raise revision</Btn></>}>
      <div className="space-y-3">
        <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: T.badBg, color: T.bad }}>
          {r.ref} was rejected{rejectedBy?.by ? ` by ${ctx.U(rejectedBy.by).name}` : ""}{rejectedBy?.note ? `: “${rejectedBy.note}”` : "."}
        </div>
        <p className="text-[12px]" style={{ color: T.sub }}>Revise the item or estimate and resubmit. Approvals start fresh, and the new requisition stays linked to the original.</p>
        <Field label="What is needed?"><input className={inputCls} style={inputStyle} value={f.item} onChange={(e) => setF({ ...f, item: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Quantity"><input type="number" className={inputCls} style={inputStyle} value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} /></Field>
          <Field label="Revised estimate (₹)"><input type="number" className={inputCls} style={inputStyle} value={f.estCost} onChange={(e) => setF({ ...f, estCost: e.target.value })} /></Field>
        </div>
        <Field label="Expected delivery"><input type="date" className={inputCls} style={inputStyle} value={f.expectedDelivery} onChange={(e) => setF({ ...f, expectedDelivery: e.target.value })} /></Field>
        <Field label="Justification"><textarea rows={3} className={inputCls} style={inputStyle} value={f.justification} onChange={(e) => setF({ ...f, justification: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export function PayModal({ kind, r, suggested, onClose, onSubmit }) {
  const [amount, setAmount] = useState(String(suggested || ""));
  const [mode, setMode] = useState("NEFT");
  const [ref, setRef] = useState("");
  const ok = Number(amount) > 0 && ref.trim();
  return (
    <Modal title={kind === "advance" ? "Record advance payment" : "Record balance payment"} onClose={onClose}
      footer={<><Btn kind="ghost" full onClick={onClose}>Cancel</Btn><Btn full disabled={!ok} onClick={() => onSubmit({ amount, mode, ref })}>Save payment</Btn></>}>
      <div className="space-y-3">
        <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: T.primarySoft, color: T.primaryDark }}>
          {r.ref} · {r.item}
          {kind === "advance" && r.advance.terms && <div className="mt-1">{r.advance.terms}</div>}
        </div>
        <Field label="Amount (₹)"><input type="number" className={inputCls} style={inputStyle} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
        <Field label="Mode"><select className={inputCls} style={inputStyle} value={mode} onChange={(e) => setMode(e.target.value)}>
          {["NEFT", "RTGS", "Cheque", "UPI", "Cash"].map((m) => <option key={m}>{m}</option>)}</select></Field>
        <Field label="UTR / Cheque no. (required)"><input className={inputCls} style={inputStyle} value={ref} onChange={(e) => setRef(e.target.value)} placeholder="UTR-4471902" /></Field>
        <p className="text-[11px]" style={{ color: T.sub }}>Enter this only after the transfer is done. Recorded in the audit trail against your name.</p>
      </div>
    </Modal>
  );
}
