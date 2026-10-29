import { useState } from "react";
import { Btn, Field, Modal, inputCls, inputStyle } from "../../components/ui";
import { FACILITY_TYPES } from "../../domain/org";
import { cx } from "../../lib/format";
import { T } from "../../theme";

export function AddPerson({ ctx, onClose, onSave }) {
  const { dealerships, departments, users } = ctx;
  const [f, setF] = useState({ name: "", empCode: "", dealershipId: dealerships[0].id, facilityId: "", deptId: departments[0].id, title: "", giveLogin: false, role: "manager" });
  const facs = ctx.facilities.filter((x) => x.dealershipId === f.dealershipId && x.active);
  const dup = users.some((u) => u.empCode.toLowerCase() === f.empCode.trim().toLowerCase());
  const ok = f.name.trim() && f.empCode.trim() && !dup;
  return (
    <Modal title="Add person" onClose={onClose}
      footer={<><Btn kind="ghost" full onClick={onClose}>Cancel</Btn>
        <Btn full disabled={!ok} onClick={() => onSave({
          name: f.name.trim(), empCode: f.empCode.trim(), dealershipIds: [f.dealershipId], facilityId: f.facilityId || null, deptId: f.deptId,
          title: f.title.trim() || "—", role: f.giveLogin ? f.role : "staff", noLogin: !f.giveLogin,
        })}>Add</Btn></>}>
      <div className="space-y-3">
        <Field label="Full name"><input className={inputCls} style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Employee code">
          <input className={inputCls} style={{ ...inputStyle, borderColor: dup ? T.bad : T.line }} value={f.empCode}
            onChange={(e) => setF({ ...f, empCode: e.target.value })} placeholder="RPW-EMP-0421" />
        </Field>
        {dup && <div className="text-[12px]" style={{ color: T.bad }}>That employee code already exists. Codes must be unique — the HRMS sync will match on them.</div>}
        <Field label="Designation"><input className={inputCls} style={inputStyle} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Service Advisor – JCB Nashik" /></Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Dealership"><select className={inputCls} style={inputStyle} value={f.dealershipId} onChange={(e) => setF({ ...f, dealershipId: e.target.value, facilityId: "" })}>
            {dealerships.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Department"><select className={inputCls} style={inputStyle} value={f.deptId} onChange={(e) => setF({ ...f, deptId: e.target.value })}>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        </div>
        <Field label="Location — showroom, workshop or outlet">
          <select className={inputCls} style={inputStyle} value={f.facilityId} onChange={(e) => setF({ ...f, facilityId: e.target.value })}>
            <option value="">— not specified —</option>
            {facs.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.type}</option>)}
          </select>
        </Field>
        <label className="flex cursor-pointer items-start gap-2 rounded-lg p-3" style={{ background: T.canvas }}>
          <input type="checkbox" className="mt-1" checked={f.giveLogin} onChange={(e) => setF({ ...f, giveLogin: e.target.checked })} />
          <span>
            <span className="block text-sm font-semibold">Give this person a platform login</span>
            <span className="block text-[12px]" style={{ color: T.sub }}>Without a login they can still hold assets — they acknowledge by signature at handover.</span>
          </span>
        </label>
        {f.giveLogin && (
          <Field label="Role"><select className={inputCls} style={inputStyle} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            <option value="manager">Dealership manager</option>
            <option value="accounts_executive">Accounts executive</option>
            <option value="business_head">Business Head</option>
            <option value="functional_head">Corporate functional head</option>
          </select></Field>
        )}
      </div>
    </Modal>
  );
}

/* Paste straight from a spreadsheet — entering 1,200 people one at a time is not realistic */
export function BulkPeople({ ctx, onClose, onSave }) {
  const { dealerships, departments, users } = ctx;
  const [text, setText] = useState("");
  const [dealershipId, setDealershipId] = useState(dealerships[0].id);
  const [deptId, setDeptId] = useState(departments[0].id);
  const [facilityId, setFacilityId] = useState("");
  const facs = ctx.facilities.filter((x) => x.dealershipId === dealershipId && x.active);

  const parsed = text.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const parts = line.split(/[,\t]/).map((x) => x.trim());
    return { name: parts[0] || "", empCode: parts[1] || "", title: parts[2] || "—" };
  });
  const valid = parsed.filter((r) => r.name && r.empCode);
  const dupes = valid.filter((r) => users.some((u) => u.empCode.toLowerCase() === r.empCode.toLowerCase())
    || valid.filter((x) => x.empCode.toLowerCase() === r.empCode.toLowerCase()).length > 1);
  const clean = valid.filter((r) => !dupes.includes(r));

  return (
    <Modal title="Paste employee list" onClose={onClose}
      footer={<><Btn kind="ghost" full onClick={onClose}>Cancel</Btn>
        <Btn full disabled={!clean.length} onClick={() => onSave(clean.map((r) => ({
          name: r.name, empCode: r.empCode, title: r.title,
          dealershipIds: [dealershipId], facilityId: facilityId || null, deptId, role: "staff", noLogin: true,
        })))}>Add {clean.length} {clean.length === 1 ? "person" : "people"}</Btn></>}>
      <div className="space-y-3">
        <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: T.primarySoft, color: T.primaryDark }}>
          One person per line: <b>Name, Employee code, Designation</b>. Copy straight from a spreadsheet column set — commas or tabs both work.
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Dealership"><select className={inputCls} style={inputStyle} value={dealershipId} onChange={(e) => { setDealershipId(e.target.value); setFacilityId(""); }}>
            {dealerships.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Department"><select className={inputCls} style={inputStyle} value={deptId} onChange={(e) => setDeptId(e.target.value)}>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        </div>
        <Field label="Location — applied to everyone in this batch">
          <select className={inputCls} style={inputStyle} value={facilityId} onChange={(e) => setFacilityId(e.target.value)}>
            <option value="">— not specified —</option>
            {facs.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.type}</option>)}
          </select>
        </Field>
        <Field label="Paste here">
          <textarea rows={7} className={cx(inputCls, "font-mono text-[12px]")} style={inputStyle} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={"Ganesh Shinde, RPW-EMP-0421, Service Advisor\nRahul Waghmare, RPW-EMP-0455, Technician"} />
        </Field>
        {text.trim() && (
          <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: dupes.length ? T.warnBg : T.okBg, color: dupes.length ? T.warn : T.ok }}>
            {clean.length} ready to add
            {parsed.length - valid.length > 0 && ` · ${parsed.length - valid.length} line(s) missing a name or code`}
            {dupes.length > 0 && ` · ${dupes.length} duplicate code(s) skipped`}
          </div>
        )}
        {clean.length > 0 && (
          <div className="max-h-32 overflow-y-auto rounded-lg p-2" style={{ background: T.canvas }}>
            {clean.slice(0, 20).map((r, i) => (
              <div key={i} className="text-[12px]"><b>{r.name}</b> <span className="font-mono" style={{ color: T.sub }}>{r.empCode}</span> · {r.title}</div>
            ))}
            {clean.length > 20 && <div className="text-[11px]" style={{ color: T.sub }}>+ {clean.length - 20} more</div>}
          </div>
        )}
      </div>
    </Modal>
  );
}

export function AddDealership({ users, onClose, onSave }) {
  const [f, setF] = useState({ name: "", brand: "", code: "", headId: "", territory: "" });
  const ok = f.name.trim() && f.code.trim();
  return (
    <Modal title="Add dealership" onClose={onClose} footer={<><Btn kind="ghost" full onClick={onClose}>Cancel</Btn><Btn full disabled={!ok} onClick={() => onSave(f)}>Add</Btn></>}>
      <div className="space-y-3">
        <Field label="Display name"><input className={inputCls} style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Mahindra Beedbypass" /></Field>
        <Field label="Brand"><input className={inputCls} style={inputStyle} value={f.brand} onChange={(e) => setF({ ...f, brand: e.target.value })} /></Field>
        <Field label="Dealer code"><input className={inputCls} style={inputStyle} value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></Field>
        <Field label="Business Head"><select className={inputCls} style={inputStyle} value={f.headId} onChange={(e) => setF({ ...f, headId: e.target.value })}>
          <option value="">— unassigned —</option>{users.filter((u) => u.role === "business_head").map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <Field label="Territory districts (comma separated)"><input className={inputCls} style={inputStyle} value={f.territory} onChange={(e) => setF({ ...f, territory: e.target.value })} placeholder="Nashik, Dhule, Jalgaon" /></Field>
      </div>
    </Modal>
  );
}

export function AddFacility({ dealerships, onClose, onSave }) {
  const [f, setF] = useState({ dealershipId: dealerships[0].id, name: "", type: FACILITY_TYPES[0], district: "" });
  const ok = f.name.trim() && f.district.trim();
  return (
    <Modal title="Add facility / outlet" onClose={onClose} footer={<><Btn kind="ghost" full onClick={onClose}>Cancel</Btn><Btn full disabled={!ok} onClick={() => onSave(f)}>Add</Btn></>}>
      <div className="space-y-3">
        <Field label="Dealership"><select className={inputCls} style={inputStyle} value={f.dealershipId} onChange={(e) => setF({ ...f, dealershipId: e.target.value })}>
          {dealerships.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
        <Field label="Facility name"><input className={inputCls} style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Yeola" /></Field>
        <Field label="Type"><select className={inputCls} style={inputStyle} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>{FACILITY_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="District"><input className={inputCls} style={inputStyle} value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export function AddDepartment({ users, onClose, onSave }) {
  const [f, setF] = useState({ name: "", dualAuthority: true, functionalHeadId: "" });
  const ok = f.name.trim();
  return (
    <Modal title="Add department" onClose={onClose} footer={<><Btn kind="ghost" full onClick={onClose}>Cancel</Btn><Btn full disabled={!ok} onClick={() => onSave({ ...f, functionalHeadId: f.functionalHeadId || null })}>Add</Btn></>}>
      <div className="space-y-3">
        <Field label="Department name"><input className={inputCls} style={inputStyle} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label="Approval model"><select className={inputCls} style={inputStyle} value={f.dualAuthority ? "dual" : "single"} onChange={(e) => setF({ ...f, dualAuthority: e.target.value === "dual" })}>
          <option value="dual">Dual — Business Head + functional head</option><option value="single">Single — Business Head only</option></select></Field>
        {f.dualAuthority && (
          <Field label="Corporate functional head"><select className={inputCls} style={inputStyle} value={f.functionalHeadId} onChange={(e) => setF({ ...f, functionalHeadId: e.target.value })}>
            <option value="">— select —</option>{users.filter((u) => u.role === "functional_head").map((u) => <option key={u.id} value={u.id}>{u.name} · {u.title}</option>)}</select></Field>
        )}
      </div>
    </Modal>
  );
}
