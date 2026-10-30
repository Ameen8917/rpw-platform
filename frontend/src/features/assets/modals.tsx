import { useState, useEffect } from "react";
import {
  X,
} from "lucide-react";
import { EmployeePicker } from "../../components/EmployeePicker";
import { SignaturePad } from "../../components/SignaturePad";
import { Btn, Field, Modal, inputCls, inputStyle } from "../../components/ui";
import { LIMITS } from "../../domain/config";
import { inrFull, inrShort } from "../../lib/format";
import { T } from "../../theme";

/* Issue an asset to a person, capturing acknowledgement at handover */
export function IssueModal({ a, ctx, onClose, onSubmit, busy = false }) {
  const { users } = ctx;
  const staff = users.filter((u) => u.dealershipIds.includes(a.dealershipId));
  const [who, setWho] = useState(staff[0]?.id || "");
  const [sig, setSig] = useState(null);
  const [note, setNote] = useState("");
  const person = users.find((u) => u.id === who);
  const canApp = person && !person.noLogin;
  const [method, setMethod] = useState("signature");
  const items = [a.name, ...(a.accessories || []).map((x) => x.name)];
  const ok = who && (method === "in_app" || sig);

  useEffect(() => { setMethod(canApp ? "in_app" : "signature"); setSig(null); }, [who, canApp]);

  return (
    <Modal title="Issue asset" onClose={onClose}
      footer={<><Btn kind="ghost" full onClick={onClose}>Cancel</Btn>
        <Btn full disabled={!ok || busy} onClick={() => onSubmit({ who, method, signature: sig, note, snapshot: items })}>
          {method === "in_app" ? "Send for acceptance" : "Record handover"}
        </Btn></>}>
      <div className="space-y-3">
        <Field label="Issue to">
          <EmployeePicker users={users} dealershipId={a.dealershipId} value={who} onChange={setWho} allowNone={false} facilityName={(id) => ctx.F(id)?.name} />
        </Field>

        <div className="rounded-lg p-3" style={{ background: T.canvas }}>
          <div className="text-xs font-bold" style={{ color: T.sub }}>Items being handed over ({items.length})</div>
          <ul className="mt-1 space-y-0.5">
            {items.map((n, i) => <li key={i} className="text-[13px]">• {n}</li>)}
          </ul>
          <p className="mt-2 text-[11px]" style={{ color: T.sub }}>This exact list is frozen into the acknowledgement record.</p>
        </div>

        {canApp ? (
          <Field label="How will they acknowledge?">
            <select className={inputCls} style={inputStyle} value={method} onChange={(e) => { setMethod(e.target.value); setSig(null); }}>
              <option value="in_app">In app — they confirm from their own login</option>
              <option value="signature">Signature now — they are here in person</option>
            </select>
          </Field>
        ) : (
          <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: T.warnBg, color: T.warn }}>
            {person?.name} has no platform login, so acknowledgement is by signature at handover.
          </div>
        )}

        {method === "in_app" ? (
          <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: T.primarySoft, color: T.primaryDark }}>
            The asset shows as “acceptance pending” until {person?.name} confirms from their own login. It stays on your pending list until then.
          </div>
        ) : (
          <Field label={`Signature of ${person?.name || "recipient"}`}>
            <SignaturePad onChange={setSig} />
          </Field>
        )}

        <Field label="Note (optional)"><input className={inputCls} style={inputStyle} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. issued for Dhule site visit" /></Field>
      </div>
    </Modal>
  );
}

/* Recording a return closes the custody loop */
export function ReturnModal({ a, ctx, onClose, onSubmit, busy = false }) {
  const { U } = ctx;
  const [sig, setSig] = useState(null);
  const [condition, setCondition] = useState("Good");
  const [missing, setMissing] = useState({});
  const items = a.acceptance?.snapshot || [a.name, ...(a.accessories || []).map((x) => x.name)];
  const missingList = items.filter((_, i) => missing[i]);
  return (
    <Modal title="Record return" onClose={onClose}
      footer={<><Btn kind="ghost" full onClick={onClose}>Cancel</Btn>
        <Btn full disabled={!sig || busy} onClick={() => onSubmit({ signature: sig, condition, missing: missingList })}>Confirm return</Btn></>}>
      <div className="space-y-3">
        <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: T.primarySoft, color: T.primaryDark }}>
          Returned by {U(a.assignedTo)?.name} · {U(a.assignedTo)?.empCode}. Tick anything not returned.
        </div>
        <div className="space-y-1">
          {items.map((n, i) => (
            <button key={i} onClick={() => setMissing((m) => ({ ...m, [i]: !m[i] }))}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left"
              style={{ background: missing[i] ? T.badBg : T.canvas }}>
              <span className="flex h-4 w-4 items-center justify-center rounded" style={{ border: "1.5px solid " + (missing[i] ? T.bad : T.line), background: missing[i] ? T.bad : "#fff" }}>
                {missing[i] && <X size={11} color="#fff" />}
              </span>
              <span className="text-[13px]" style={{ textDecoration: missing[i] ? "line-through" : "none" }}>{n}</span>
              {missing[i] && <span className="ml-auto text-[11px] font-semibold" style={{ color: T.bad }}>not returned</span>}
            </button>
          ))}
        </div>
        <Field label="Condition">
          <select className={inputCls} style={inputStyle} value={condition} onChange={(e) => setCondition(e.target.value)}>
            {["Good", "Minor damage", "Damaged — needs repair", "Not working"].map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Signature of person returning"><SignaturePad onChange={setSig} /></Field>
      </div>
    </Modal>
  );
}

export function AcceptModal({ a, onClose, onSubmit, busy = false }) {
  const items = [a.name, ...(a.accessories || []).map((x) => x.name)];
  const [confirmed, setConfirmed] = useState(false);
  return (
    <Modal title="Accept this asset" onClose={onClose}
      footer={<><Btn kind="ghost" full onClick={onClose}>Cancel</Btn>
        <Btn full disabled={!confirmed || busy} onClick={onSubmit}>Confirm receipt</Btn></>}>
      <div className="space-y-3">
        <p className="text-[13px]" style={{ color: T.sub }}>
          Confirming records that you received these items and hold them in your custody.
        </p>
        <div className="rounded-lg p-3" style={{ background: T.canvas }}>
          {items.map((n, i) => <div key={i} className="text-[13px]">• {n}</div>)}
        </div>
        <label className="flex cursor-pointer items-start gap-2">
          <input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
          <span className="text-[13px]">I have received all {items.length} item{items.length > 1 ? "s" : ""} listed above in working condition.</span>
        </label>
      </div>
    </Modal>
  );
}

export function AccessoryModal({ a, onClose, onSubmit, busy = false }) {
  const [f, setF] = useState({ name: "", serial: "", origin: "bundled", cost: "", addedAt: "2026-09-06" });
  const cost = Number(f.cost) || 0;
  const aboveFloor = f.origin === "separate" && cost >= LIMITS.capitalisation;
  const ok = f.name.trim() && (f.origin === "bundled" || f.cost);
  return (
    <Modal title="Add accessory" onClose={onClose}
      footer={<><Btn kind="ghost" full onClick={onClose}>Cancel</Btn>
        <Btn full disabled={!ok || aboveFloor || busy} onClick={() => onSubmit({ ...f, cost })}>Add accessory</Btn></>}>
      <div className="space-y-3">
        <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: T.primarySoft, color: T.primaryDark }}>
          Attaching to <b>{a.name}</b> ({a.code}). Accessories are tracked for custody, not depreciated separately.
        </div>
        <Field label="What is it?"><input className={inputCls} style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. 25W charger & cable" /></Field>
        <Field label="Where did it come from?">
          <select className={inputCls} style={inputStyle} value={f.origin} onChange={(e) => setF({ ...f, origin: e.target.value })}>
            <option value="bundled">Came bundled with the asset</option>
            <option value="separate">Bought separately</option>
          </select>
        </Field>
        {f.origin === "bundled" ? (
          <p className="text-[12px]" style={{ color: T.sub }}>No separate cost — already included in the purchase value of the asset.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Cost (₹)"><input type="number" className={inputCls} style={inputStyle} value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} placeholder="850" /></Field>
              <Field label="Date"><input type="date" className={inputCls} style={inputStyle} value={f.addedAt} onChange={(e) => setF({ ...f, addedAt: e.target.value })} /></Field>
            </div>
            {aboveFloor ? (
              <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: T.badBg, color: T.bad }}>
                At {inrFull(cost)} this is at or above the {inrShort(LIMITS.capitalisation)} capitalisation floor, so it should be registered as an asset in its own right with its own code and depreciation — not as an accessory. Add it through “Add existing asset” or a requisition instead.
              </div>
            ) : cost > 0 && (
              <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: T.warnBg, color: T.warn }}>
                Below the {inrShort(LIMITS.capitalisation)} floor — recorded as a revenue expense, tracked here for custody only.
              </div>
            )}
          </>
        )}
        <Field label="Serial no. (optional)"><input className={inputCls} style={inputStyle} value={f.serial} onChange={(e) => setF({ ...f, serial: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export function DisposeModal({ a, onClose, onSubmit, busy = false }) {
  const [reason, setReason] = useState(""); const [scrap, setScrap] = useState("");
  return (
    <Modal title="Dispose / write off" onClose={onClose}
      footer={<><Btn kind="ghost" full onClick={onClose}>Cancel</Btn><Btn kind="danger" full disabled={!reason.trim() || busy} onClick={() => onSubmit(reason, scrap)}>Confirm write-off</Btn></>}>
      <div className="space-y-3">
        <div className="rounded-lg px-3 py-2 text-[13px]" style={{ background: T.badBg, color: T.bad }}>
          Removes <b>{a.name}</b> ({inrShort(a.cost)}) from live assets. Permanently recorded in the audit trail.
        </div>
        <Field label="Reason"><textarea rows={2} className={inputCls} style={inputStyle} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        <Field label="Scrap value (₹, optional)"><input type="number" className={inputCls} style={inputStyle} value={scrap} onChange={(e) => setScrap(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
