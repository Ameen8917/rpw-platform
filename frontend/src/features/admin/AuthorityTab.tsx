import { useState } from "react";
import {
  ShieldCheck, Search, Plus, ChevronRight, CheckCircle2, Landmark,
} from "lucide-react";
import { EmployeePicker } from "../../components/EmployeePicker";
import { Avatar, Btn, Card, Field, Modal, SectionTitle, Td, Th, inputCls, inputStyle } from "../../components/ui";
import { LIMITS } from "../../domain/config";
import { CAPABILITIES, ROLE_OPTIONS } from "../../domain/permissions";
import { AddPerson } from "./forms";
import { inrShort } from "../../lib/format";
import { T } from "../../theme";

export function AuthorityTab({ ctx, setUsers, setDealerships, setDepartments, onLog, notify }) {
  const { users, D, DEP } = ctx;
  const [edit, setEdit] = useState(null);
  const [handover, setHandover] = useState(null);
  const [addNew, setAddNew] = useState(false);
  const [rules, setRules] = useState({ ...LIMITS });
  const [q, setQ] = useState("");
  const withLogin = users.filter((u) => !u.noLogin && !u.inactive)
    .filter((u) => !q || (u.name + u.empCode + u.title).toLowerCase().includes(q.toLowerCase()));

  function saveRules(next) {
    Object.assign(LIMITS, next); /* module-level rules the workflow reads */
    setRules({ ...next });
    onLog("Updated authority rules", "group", `Purchase ${inrShort(next.purchaseDirector)} · advance ${inrShort(next.advanceEscalation)} · payment ${inrShort(next.directorPayment)}`);
    notify("Authority rules updated");
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle icon={ShieldCheck}>Who can do what</SectionTitle>
        <p className="mt-1 text-[13px]" style={{ color: T.sub }}>
          Every person with a login, and the powers their role carries. Tap anyone to change their role, scope or approval limit.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <div className="flex flex-1 items-center gap-2 rounded-lg px-3 py-2" style={{ border: "1px solid " + T.line }}>
            <Search size={16} style={{ color: T.sub }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search person" className="w-full text-sm outline-none" />
          </div>
          <Btn size="sm" icon={Plus} onClick={() => setAddNew(true)}>Add person</Btn>
        </div>
      </Card>

      {/* Desktop: full matrix */}
      <Card pad={false} className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: T.canvas, color: T.sub }}>
              <Th>Person</Th><Th>Role & scope</Th>
              {CAPABILITIES.map((c) => <Th key={c.key} right><span title={c.label}>{c.short}</span></Th>)}
              <Th right>Limit</Th>
            </tr>
          </thead>
          <tbody>
            {withLogin.map((u, i) => (
              <tr key={u.id} onClick={() => setEdit(u)} className="cursor-pointer hover:bg-slate-50" style={{ borderTop: i ? "1px solid " + T.line : "none" }}>
                <Td>
                  <div className="font-semibold">{u.name}</div>
                  <div className="font-mono text-[11px]" style={{ color: T.sub }}>{u.empCode}</div>
                </Td>
                <Td sub>
                  <div>{ROLE_OPTIONS.find((r) => r.value === u.role)?.label || u.role}</div>
                  <div className="text-[11px]">
                    {u.dealershipIds.map((d) => D(d)?.name).join(", ")}{u.deptId ? ` · ${DEP(u.deptId)?.name}` : ""}
                  </div>
                </Td>
                {CAPABILITIES.map((c) => (
                  <Td key={c.key} right>
                    {c.has(u)
                      ? <CheckCircle2 size={15} style={{ color: T.ok, display: "inline" }} />
                      : <span style={{ color: T.line }}>—</span>}
                  </Td>
                ))}
                <Td right sub>{u.approvalLimit ? inrShort(u.approvalLimit) : "No cap"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Mobile: one card per person */}
      <div className="space-y-2 md:hidden">
        {withLogin.map((u) => (
          <button key={u.id} onClick={() => setEdit(u)} className="w-full text-left"><Card>
            <div className="flex items-center gap-3">
              <Avatar name={u.name} size={34} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">{u.name}</div>
                <div className="text-[11px]" style={{ color: T.sub }}>
                  {ROLE_OPTIONS.find((r) => r.value === u.role)?.label} · {u.dealershipIds.map((d) => D(d)?.name).join(", ")}
                </div>
              </div>
              <ChevronRight size={16} style={{ color: T.sub }} />
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {CAPABILITIES.filter((c) => c.has(u)).map((c) => (
                <span key={c.key} className="whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium" style={{ color: T.primary, background: T.primarySoft }}>{c.short}</span>
              ))}
              {u.approvalLimit && <span className="whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium" style={{ color: T.warn, background: T.warnBg }}>up to {inrShort(u.approvalLimit)}</span>}
            </div>
          </Card></button>
        ))}
      </div>

      <RulesCard rules={rules} onSave={saveRules} />

      {handover && <HandoverModal leaver={handover} ctx={ctx} onClose={() => setHandover(null)}
        onConfirm={({ successorId, revoke }) => {
          const succ = users.find((u) => u.id === successorId);
          /* 1. Successor inherits role, scope and limit */
          setUsers((l) => l.map((x) => {
            if (x.id === successorId) return { ...x, role: handover.role, deptId: handover.deptId, dealershipIds: [...handover.dealershipIds], approvalLimit: handover.approvalLimit || null, noLogin: false };
            if (x.id === handover.id && revoke) return { ...x, role: "staff", noLogin: true, approvalLimit: null, inactive: true };
            return x;
          }));
          /* 2. Repoint any dealership they headed — this reroutes pending approvals automatically */
          setDealerships((l) => l.map((d) => d.headId === handover.id ? { ...d, headId: successorId } : d));
          /* 3. Repoint any function they headed */
          setDepartments((l) => l.map((d) => d.functionalHeadId === handover.id ? { ...d, functionalHeadId: successorId } : d));
          onLog("Role handover", handover.empCode, `${handover.name} → ${succ?.name} (${succ?.empCode})${revoke ? " · access revoked" : ""}`);
          notify(`${succ?.name} now holds this role`);
          setHandover(null);
        }} />}

      {addNew && <AddPerson ctx={ctx} onClose={() => setAddNew(false)} onSave={(u) => {
        setUsers((l) => [...l, { id: "U_" + Date.now(), source: "manual", ...u }]);
        onLog("Added employee", u.empCode, `${u.name} · ${u.title}`);
        notify("Person added — now assign their authority"); setAddNew(false);
      }} />}

      {edit && <EditAuthority u={edit} ctx={ctx} onHandover={() => { setHandover(edit); setEdit(null); }} onClose={() => setEdit(null)} onSave={(next) => {
        setUsers((l) => l.map((x) => x.id === edit.id ? { ...x, ...next } : x));
        onLog("Changed authority", edit.empCode, `${edit.name} → ${ROLE_OPTIONS.find((r) => r.value === next.role)?.label}${next.approvalLimit ? ` · limit ${inrShort(next.approvalLimit)}` : ""}`);
        notify("Authority updated"); setEdit(null);
      }} />}
    </div>
  );
}

export function RulesCard({ rules, onSave }) {
  const [f, setF] = useState({ ...rules });
  const dirty = JSON.stringify(f) !== JSON.stringify(rules);
  const set = (k) => (e) => setF({ ...f, [k]: Number(e.target.value) });
  return (
    <Card>
      <SectionTitle icon={Landmark}>Group rules</SectionTitle>
      <p className="mt-1 text-[13px]" style={{ color: T.sub }}>
        The value limits that decide when an extra signature is needed. These apply across every dealership.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Purchase needing Director approval (₹, above)"><input type="number" className={inputCls} style={inputStyle} value={f.purchaseDirector} onChange={set("purchaseDirector")} /></Field>
        <Field label="Advance needing GM Finance + Director (₹, above)"><input type="number" className={inputCls} style={inputStyle} value={f.advanceEscalation} onChange={set("advanceEscalation")} /></Field>
        <Field label="Payment skipping Director (₹, below)"><input type="number" className={inputCls} style={inputStyle} value={f.directorPayment} onChange={set("directorPayment")} /></Field>
        <Field label="Capitalisation floor (₹)"><input type="number" className={inputCls} style={inputStyle} value={f.capitalisation} onChange={set("capitalisation")} /></Field>
        <Field label="Escalate after (days)"><input type="number" className={inputCls} style={inputStyle} value={f.slaDays} onChange={set("slaDays")} /></Field>
        <Field label="Cost overrun tolerance (%)"><input type="number" className={inputCls} style={inputStyle} value={f.variancePct} onChange={set("variancePct")} /></Field>
      </div>
      <div className="mt-3 flex gap-2">
        <Btn size="sm" disabled={!dirty} onClick={() => onSave(f)}>Save rules</Btn>
        {dirty && <Btn size="sm" kind="ghost" onClick={() => setF({ ...rules })}>Reset</Btn>}
      </div>
    </Card>
  );
}

/* Replacing a person: move the role, repoint headships, surface what they still hold */
export function HandoverModal({ leaver, ctx, onClose, onConfirm }) {
  const { users, dealerships, departments, assets, D, DEP } = ctx;
  const [successorId, setSuccessorId] = useState("");
  const [revoke, setRevoke] = useState(true);
  const successor = users.find((u) => u.id === successorId);

  const headOf = dealerships.filter((d) => d.headId === leaver.id);
  const fnHeadOf = departments.filter((d) => d.functionalHeadId === leaver.id);
  const held = assets.filter((a) => a.assignedTo === leaver.id && a.status !== "disposed");
  const heldItems = held.reduce((s2, a) => s2 + 1 + (a.accessories?.length || 0), 0);

  return (
    <Modal title={`Replace ${leaver.name}`} onClose={onClose}
      footer={<><Btn kind="ghost" full onClick={onClose}>Cancel</Btn>
        <Btn full disabled={!successorId} onClick={() => onConfirm({ successorId, revoke })}>Transfer role</Btn></>}>
      <div className="space-y-3">
        <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: T.canvas, color: T.sub }}>
          Leaving: <b style={{ color: T.ink }}>{leaver.name}</b> · <span className="font-mono">{leaver.empCode}</span> · {ROLE_OPTIONS.find((r) => r.value === leaver.role)?.label}
        </div>

        <Field label="Who takes over?">
          <EmployeePicker users={users.filter((u) => u.id !== leaver.id && !u.inactive)} value={successorId}
            onChange={setSuccessorId} allowNone={false} />
        </Field>
        <p className="text-[11px]" style={{ color: T.sub }}>
          Not on the list? Close this, add them with “Add person”, then come back.
        </p>

        <div className="rounded-lg p-3" style={{ background: T.primarySoft }}>
          <div className="text-xs font-semibold" style={{ color: T.primaryDark }}>What transfers</div>
          <ul className="mt-1 space-y-0.5 text-[12px]" style={{ color: T.ink }}>
            <li>• Role: {ROLE_OPTIONS.find((r) => r.value === leaver.role)?.label}</li>
            <li>• Scope: {leaver.dealershipIds.map((d) => D(d)?.name).join(", ")}{leaver.deptId ? ` · ${DEP(leaver.deptId)?.name}` : ""}</li>
            <li>• Approval limit: {leaver.approvalLimit ? inrShort(leaver.approvalLimit) : "no cap"}</li>
            {headOf.length > 0 && <li>• Business Head of {headOf.map((d) => d.name).join(", ")}</li>}
            {fnHeadOf.length > 0 && <li>• Functional head for {fnHeadOf.map((d) => d.name).join(", ")}</li>}
          </ul>
          <p className="mt-2 text-[11px]" style={{ color: T.sub }}>
            Anything currently waiting on {leaver.name.split(" ")[0]} for approval moves to {successor ? successor.name.split(" ")[0] : "the successor"} automatically — approvals follow the role, not the person.
          </p>
        </div>

        {held.length > 0 && (
          <div className="rounded-lg p-3" style={{ background: T.warnBg }}>
            <div className="text-xs font-semibold" style={{ color: T.warn }}>Still holding {held.length} asset{held.length > 1 ? "s" : ""} ({heldItems} items)</div>
            <div className="mt-1 space-y-0.5 text-[12px]" style={{ color: T.ink }}>
              {held.map((a) => <div key={a.id}>• {a.name} <span className="font-mono text-[11px]" style={{ color: T.sub }}>{a.code}</span></div>)}
            </div>
            <p className="mt-1 text-[11px]" style={{ color: T.warn }}>
              This transfer does not move assets. Record each return in the Custody tab as part of exit clearance.
            </p>
          </div>
        )}

        <label className="flex cursor-pointer items-start gap-2 rounded-lg p-3" style={{ background: T.canvas }}>
          <input type="checkbox" className="mt-1" checked={revoke} onChange={(e) => setRevoke(e.target.checked)} />
          <span>
            <span className="block text-sm font-semibold">Revoke {leaver.name.split(" ")[0]}&rsquo;s access now</span>
            <span className="block text-[12px]" style={{ color: T.sub }}>
              Removes their login and authority. Their history stays on record. Untick if they are handing over gradually.
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}

export function EditAuthority({ u, ctx, onClose, onSave, onHandover }) {
  const { dealerships, departments } = ctx;
  const [f, setF] = useState({
    role: u.role, deptId: u.deptId || "", dealershipId: u.dealershipIds[0],
    approvalLimit: u.approvalLimit ? String(u.approvalLimit) : "", noLogin: !!u.noLogin,
  });
  const preview = { ...u, role: f.role, deptId: f.deptId, noLogin: f.noLogin };
  const needsDept = ["functional_head", "manager", "accounts_executive"].includes(f.role);
  return (
    <Modal title={`Authority — ${u.name}`} onClose={onClose}
      footer={<><Btn kind="ghost" full onClick={onClose}>Cancel</Btn>
        <Btn full onClick={() => onSave({
          role: f.role, deptId: f.deptId || null, dealershipIds: [f.dealershipId],
          approvalLimit: f.approvalLimit ? Number(f.approvalLimit) : null, noLogin: f.noLogin,
        })}>Save</Btn></>}>
      <div className="space-y-3">
        <div className="rounded-lg px-3 py-2 text-[12px]" style={{ background: T.canvas, color: T.sub }}>
          <span className="font-mono">{u.empCode}</span> · {u.title}
        </div>

        <Field label="Role in the workflow">
          <select className={inputCls} style={inputStyle} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </Field>
        <p className="text-[12px]" style={{ color: T.sub }}>{ROLE_OPTIONS.find((r) => r.value === f.role)?.note}</p>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Dealership"><select className={inputCls} style={inputStyle} value={f.dealershipId} onChange={(e) => setF({ ...f, dealershipId: e.target.value })}>
            {dealerships.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          {needsDept && <Field label="Department"><select className={inputCls} style={inputStyle} value={f.deptId} onChange={(e) => setF({ ...f, deptId: e.target.value })}>
            <option value="">— none —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>}
        </div>

        <Field label="Approval limit (₹, optional)">
          <input type="number" className={inputCls} style={inputStyle} value={f.approvalLimit}
            onChange={(e) => setF({ ...f, approvalLimit: e.target.value })} placeholder="Leave blank for no cap" />
        </Field>
        <p className="text-[12px]" style={{ color: T.sub }}>
          Above this value their approval alone is not enough — it goes to the Director as well. Leave blank if their role has no ceiling.
        </p>

        {onHandover && (
          <button onClick={onHandover} className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left" style={{ background: T.warnBg }}>
            <span>
              <span className="block text-sm font-semibold" style={{ color: T.warn }}>This person is leaving — hand the role over</span>
              <span className="block text-[12px]" style={{ color: T.sub }}>Moves role, scope and headships to someone else, and revokes their access.</span>
            </span>
            <ChevronRight size={16} style={{ color: T.warn }} />
          </button>
        )}

        <div className="rounded-lg p-3" style={{ background: T.primarySoft }}>
          <div className="text-xs font-semibold" style={{ color: T.primaryDark }}>This person will be able to</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {CAPABILITIES.filter((c) => c.has(preview)).map((c) => (
              <span key={c.key} className="whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium" style={{ color: T.primary, background: "#fff" }}>{c.label}</span>
            ))}
            {CAPABILITIES.filter((c) => c.has(preview)).length === 0 && (
              <span className="text-[12px]" style={{ color: T.sub }}>Nothing — view only, and can hold assets.</span>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
