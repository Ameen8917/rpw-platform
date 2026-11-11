import { useState } from "react";
import {
  ShieldCheck, Search, Plus, ChevronRight, Check, Landmark,
} from "lucide-react";
import { EmployeePicker } from "../../components/EmployeePicker";
import { Avatar, Btn, Card, Field, Modal, SectionTitle, inputCls, inputStyle } from "../../components/ui";
import { LIMITS } from "../../domain/config";
import { CAPABILITIES, CAPABILITY_GROUPS, ROLE_OPTIONS } from "../../domain/permissions";
import { useAdminSave } from "./useAdminSave";
import { AddPerson } from "./forms";
import { adminApi, settingsApi } from "../requisitions/api";
import { inrShort } from "../../lib/format";
import { T } from "../../theme";

export function AuthorityTab({ ctx, onChanged, notify }) {
  const { users, D, DEP } = ctx;
  const [edit, setEdit] = useState(null);
  const [handover, setHandover] = useState(null);
  const [addNew, setAddNew] = useState(false);
  const [rules, setRules] = useState({ ...LIMITS });
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const save = useAdminSave(onChanged, notify);
  const active = users.filter((u) => !u.noLogin && !u.inactive);
  const roleRank = (r) => { const i = ROLE_OPTIONS.findIndex((o) => o.value === r); return i < 0 ? 99 : i; };
  /* Most senior first, then by name, so the matrix reads top-down like the approval chain */
  const withLogin = active
    .filter((u) => role === "all" || u.role === role)
    .filter((u) => !q || (u.name + u.empCode + u.title).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => roleRank(a.role) - roleRank(b.role) || a.name.localeCompare(b.name));
  const roleCounts = ROLE_OPTIONS.map((r) => ({ ...r, count: active.filter((u) => u.role === r.value).length }))
    .filter((r) => r.count > 0);
  const scopeOf = (u) => [u.dealershipIds.map((d) => D(d)?.name).filter(Boolean).join(", "), u.deptId ? DEP(u.deptId)?.name : ""]
    .filter(Boolean).join(" · ");

  /* Saved on the server; the reload writes them into LIMITS, which the workflow rules read */
  async function saveRules(next) {
    if (await save(() => settingsApi.save(next), "Authority rules updated")) setRules({ ...LIMITS });
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
        <div className="mt-3 flex flex-wrap gap-1.5">
          <RoleChip active={role === "all"} onClick={() => setRole("all")} label="Everyone" count={active.length} />
          {roleCounts.map((r) => (
            <RoleChip key={r.value} active={role === r.value} onClick={() => setRole(r.value)} label={r.label} count={r.count} />
          ))}
        </div>
      </Card>

      {/* Desktop: full matrix, columns banded by workflow stage */}
      <Card pad={false} className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr style={{ background: T.canvas, color: T.sub }}>
              <th rowSpan={2} className="sticky left-0 z-10 px-4 py-2 text-left align-bottom text-[10.5px] font-semibold uppercase tracking-wide" style={{ background: T.canvas, minWidth: 260 }}>
                Person &amp; role
              </th>
              {CAPABILITY_GROUPS.map((g) => (
                <th key={g.key} colSpan={CAPABILITIES.filter((c) => c.group === g.key).length}
                  className="px-2 pb-1 pt-2.5 text-center text-[10.5px] font-semibold uppercase tracking-wide"
                  style={{ borderLeft: "1px solid " + T.line, color: T.ink }}>
                  {g.label}
                </th>
              ))}
              <th rowSpan={2} className="px-4 py-2 text-right align-bottom text-[10.5px] font-semibold uppercase tracking-wide" style={{ borderLeft: "1px solid " + T.line }}>
                Approval limit
              </th>
              <th rowSpan={2} aria-label="Edit" style={{ width: 32 }} />
            </tr>
            <tr style={{ background: T.canvas, color: T.sub }}>
              {CAPABILITIES.map((c, i) => (
                <th key={c.key} title={c.label}
                  className="px-1.5 pb-2.5 pt-1 text-center align-bottom text-[11px] font-medium leading-tight"
                  style={{ minWidth: 64, borderLeft: i === 0 || c.group !== CAPABILITIES[i - 1].group ? "1px solid " + T.line : "none" }}>
                  {c.short}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {withLogin.map((u) => (
              <tr key={u.id} onClick={() => setEdit(u)} className="group cursor-pointer" style={{ borderTop: "1px solid " + T.line }}>
                <td className="sticky left-0 z-10 px-4 py-2.5 group-hover:!bg-[#FAF9F7]" style={{ background: T.surface }}>
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} size={32} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="whitespace-nowrap font-semibold">{u.name}</span>
                        <RoleBadge role={u.role} />
                      </div>
                      <div className="mt-0.5 truncate text-[11.5px]" style={{ color: T.sub, maxWidth: 240 }} title={scopeOf(u)}>
                        <span className="font-mono">{u.empCode}</span>{scopeOf(u) && <> · {scopeOf(u)}</>}
                      </div>
                    </div>
                  </div>
                </td>
                {CAPABILITIES.map((c, i) => {
                  const yes = c.has(u);
                  return (
                    <td key={c.key} className="px-1.5 py-2.5 text-center group-hover:bg-[#FAF9F7]"
                      style={{ borderLeft: i === 0 || c.group !== CAPABILITIES[i - 1].group ? "1px solid " + T.line : "none" }}
                      title={`${c.label}: ${yes ? "yes" : "no"}`}>
                      {yes
                        ? <span className="inline-flex h-6 w-6 items-center justify-center rounded-full" style={{ background: T.okBg }}>
                            <Check size={14} strokeWidth={2.75} style={{ color: T.ok }} />
                          </span>
                        : <span className="inline-block h-1 w-1 rounded-full align-middle" style={{ background: T.line }} aria-label="no" />}
                    </td>
                  );
                })}
                <td className="whitespace-nowrap px-4 py-2.5 text-right group-hover:bg-[#FAF9F7]" style={{ borderLeft: "1px solid " + T.line }}>
                  {u.approvalLimit
                    ? <span className="rounded-[4px] px-2 py-0.5 text-[12px] font-medium" style={{ color: T.warn, background: T.warnBg }}>Up to {inrShort(u.approvalLimit)}</span>
                    : <span className="text-[12px]" style={{ color: T.sub }}>No cap</span>}
                </td>
                <td className="pr-3 group-hover:bg-[#FAF9F7]">
                  <ChevronRight size={16} className="opacity-40 group-hover:opacity-100" style={{ color: T.sub }} />
                </td>
              </tr>
            ))}
            {withLogin.length === 0 && (
              <tr><td colSpan={CAPABILITIES.length + 3} className="px-4 py-8 text-center text-[13px]" style={{ color: T.sub }}>
                No one matches this search.
              </td></tr>
            )}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-[11.5px]" style={{ borderTop: "1px solid " + T.line, color: T.sub, background: T.canvas }}>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full" style={{ background: T.okBg }}><Check size={10} strokeWidth={3} style={{ color: T.ok }} /></span>
            Has this power
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1 w-1 rounded-full" style={{ background: T.sub }} /> Does not
          </span>
          <span>Hover a column heading for its full meaning. Click a row to change role, scope or limit.</span>
        </div>
      </Card>

      {/* Mobile: one card per person */}
      <div className="space-y-2 md:hidden">
        {withLogin.map((u) => (
          <button key={u.id} onClick={() => setEdit(u)} className="w-full text-left"><Card>
            <div className="flex items-center gap-3">
              <Avatar name={u.name} size={34} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="text-sm font-semibold">{u.name}</span>
                  <RoleBadge role={u.role} />
                </div>
                <div className="truncate text-[11px]" style={{ color: T.sub }}>{scopeOf(u)}</div>
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
        onConfirm={async ({ successorId, revoke }) => {
          /* The server moves role, scope, limit, personal powers and headships, so pending approvals follow */
          const succ = users.find((u) => u.id === successorId);
          if (await save(() => adminApi.handover(handover.id, successorId, revoke), `${succ?.name} now holds this role`)) setHandover(null);
        }} />}

      {addNew && <AddPerson ctx={ctx} onClose={() => setAddNew(false)} onSave={async (u) => {
        if (await save(() => adminApi.addPerson(u), "Person added — now assign their authority")) setAddNew(false);
      }} />}

      {edit && <EditAuthority u={edit} ctx={ctx} onHandover={() => { setHandover(edit); setEdit(null); }} onClose={() => setEdit(null)} onSave={async (next) => {
        if (await save(() => adminApi.setAuthority(edit.id, next), "Authority updated")) setEdit(null);
      }} />}
    </div>
  );
}

/* One tone per role so seniority is readable at a glance */
const ROLE_TONE = {
  director: { color: T.surface, background: T.primary },
  business_head: { color: T.accent, background: T.warnBg },
  functional_head: { color: T.ok, background: T.okBg },
  manager: { color: T.slate, background: T.slateBg },
  accounts_executive: { color: T.primary, background: T.primarySoft },
};

function RoleBadge({ role }) {
  const label = ROLE_OPTIONS.find((r) => r.value === role)?.label || role;
  return (
    <span className="whitespace-nowrap rounded-[4px] px-1.5 py-px text-[10.5px] font-semibold"
      style={ROLE_TONE[role] || { color: T.sub, background: T.canvas }}>
      {label}
    </span>
  );
}

function RoleChip({ active, onClick, label, count }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active}
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-medium transition-colors"
      style={active
        ? { background: T.primary, color: T.surface, border: "1px solid " + T.primary }
        : { background: T.surface, color: T.ink, border: "1px solid " + T.line }}>
      {label}
      <span className="text-[11px]" style={{ opacity: 0.65 }}>{count}</span>
    </button>
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
          role: f.role, deptId: needsDept ? f.deptId || null : null,
          /* Business Heads may hold several dealerships; this form changes the first */
          dealershipIds: [f.dealershipId, ...u.dealershipIds.slice(1).filter((d) => d !== f.dealershipId && f.role === "business_head")],
          approvalLimit: f.approvalLimit ? Number(f.approvalLimit) : null,
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
