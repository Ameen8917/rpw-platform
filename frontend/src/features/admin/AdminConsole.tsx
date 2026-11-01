import { useState } from "react";
import {
  ShieldCheck, Search, Plus, ArrowRightLeft, Building2, MapPin, FileText, Users, Layers,
  type LucideIcon,
} from "lucide-react";
import { Avatar, Btn, Card, MiniStat, PageHead, SectionTitle } from "../../components/ui";
import { AuthorityTab } from "./AuthorityTab";
import { AddDealership, AddDepartment, AddFacility, AddPerson, BulkPeople } from "./forms";
import { T } from "../../theme";

export function AdminConsole({ ctx, setDealerships, setFacilities, setDepartments, setUsers, onLog, notify }) {
  const { dealerships, facilities, departments, users, U } = ctx;
  const [tab, setTab] = useState("authority");
  const [modal, setModal] = useState(null);
  const [peopleQ, setPeopleQ] = useState("");

  const tabs: [string, string, LucideIcon][] = [["authority", "Authority", ShieldCheck], ["users", "People", Users], ["dealerships", "Dealerships", Building2], ["facilities", "Locations", MapPin], ["departments", "Departments", Layers]];

  function toggleActive(kind, id) {
    const setter = kind === "dealerships" ? setDealerships : kind === "facilities" ? setFacilities : setDepartments;
    setter((list) => list.map((x) => x.id === id ? { ...x, active: !x.active } : x));
    onLog("Updated master data", id, `${kind.slice(0, -1)} activation toggled`);
    notify("Master data updated");
  }

  return (
    <div className="space-y-4">
      <PageHead title="Admin console" sub="Master data — owned by IT & Admin" />
      <div className="rounded-lg px-3 py-2.5 text-[12px]" style={{ background: T.warnBg, color: T.warn }}>
        Changes here affect every module. All edits are written to the audit trail.
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg p-1" style={{ background: T.surface, border: "1px solid " + T.line }}>
        {tabs.map(([k, l, Icon]) => (
          <button key={k} onClick={() => setTab(k)} className="flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold"
            style={tab === k ? { background: T.primarySoft, color: T.primary } : { color: T.sub }}><Icon size={15} />{l}</button>
        ))}
      </div>

      {tab === "dealerships" && (
        <Card pad={false}>
          <AdminHead title={`${dealerships.length} dealerships`} onAdd={() => setModal("dealership")} />
          <div className="divide-y" style={{ borderColor: T.line }}>
            {dealerships.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{d.name}</span>
                    <span className="font-mono text-[11px]" style={{ color: T.sub }}>{d.code}</span>
                    {!d.active && <span className="whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium" style={{ color: T.warn, background: T.warnBg }}>Inactive</span>}
                  </div>
                  <div className="text-[11px]" style={{ color: T.sub }}>
                    {d.brand} · Head: {d.headId ? U(d.headId).name : "unassigned"}{d.territory.length ? ` · ${d.territory.length} districts` : ""}
                  </div>
                  {d.note && <div className="text-[11px]" style={{ color: T.warn }}>{d.note}</div>}
                </div>
                <Btn size="sm" kind="secondary" onClick={() => toggleActive("dealerships", d.id)}>{d.active ? "Deactivate" : "Activate"}</Btn>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === "facilities" && (
        <Card pad={false}>
          <AdminHead title={`${facilities.length} facilities / outlets`} onAdd={() => setModal("facility")} />
          <div className="divide-y" style={{ borderColor: T.line }}>
            {dealerships.map((d) => {
              const fs = facilities.filter((f) => f.dealershipId === d.id);
              if (!fs.length) return null;
              return (
                <div key={d.id} className="px-4 py-3">
                  <div className="mb-2 text-xs font-semibold" style={{ color: T.primary }}>{d.name}</div>
                  <div className="space-y-1.5">
                    {fs.map((f) => (
                      <div key={f.id} className="flex items-center justify-between rounded-lg px-3 py-2" style={{ background: T.canvas }}>
                        <div>
                          <div className="text-sm font-semibold">{f.name} {!f.active && <span className="text-[10px]" style={{ color: T.warn }}>(inactive)</span>}</div>
                          <div className="text-[11px]" style={{ color: T.sub }}>{f.type} · {f.district}</div>
                        </div>
                        <button onClick={() => toggleActive("facilities", f.id)} className="text-[11px] font-semibold" style={{ color: T.primary }}>{f.active ? "Deactivate" : "Activate"}</button>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {tab === "departments" && (
        <>
        <Card className="mb-3">
          <SectionTitle icon={Layers}>What this list controls</SectionTitle>
          <p className="mt-1 text-[13px]" style={{ color: T.sub }}>
            These are the departments that appear in every dropdown across the platform. Each one carries a rule:
            whether a requisition from it needs two signatures (Business Head plus a corporate head) or just the Business Head.
            To change who a person is or what they can approve, use the Authority tab.
          </p>
        </Card>
        <Card pad={false}>
          <AdminHead title={`${departments.length} departments`} onAdd={() => setModal("department")} />
          <div className="divide-y" style={{ borderColor: T.line }}>
            {departments.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{d.name}</span>
                    {d.dualAuthority
                      ? <span className="whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium" style={{ color: T.primary, background: T.primarySoft }}>Dual authority</span>
                      : <span className="whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium" style={{ color: T.sub, background: T.slateBg }}>Business Head only</span>}
                  </div>
                  <div className="text-[11px]" style={{ color: T.sub }}>
                    {d.functionalHeadId ? `Functional head: ${U(d.functionalHeadId).name}` : "No corporate functional head"}
                  </div>
                </div>
                <Btn size="sm" kind="secondary" onClick={() => toggleActive("departments", d.id)}>{d.active ? "Deactivate" : "Activate"}</Btn>
              </div>
            ))}
          </div>
        </Card>
        </>
      )}

      {tab === "authority" && (
        <AuthorityTab ctx={ctx} setUsers={setUsers} setDealerships={setDealerships} setDepartments={setDepartments} onLog={onLog} notify={notify} />
      )}

      {tab === "users" && (
        <Card className="mb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <SectionTitle icon={ArrowRightLeft}>Employee directory</SectionTitle>
              <p className="mt-1 text-[13px]" style={{ color: T.sub }}>
                Maintained here for now. When the HRMS connection is set up, records will match on employee code — so anything entered now carries over rather than duplicating.
              </p>
            </div>
            <span className="whitespace-nowrap rounded-[4px] px-2.5 py-0.5 text-[11px] font-medium" style={{ color: T.warn, background: T.warnBg }}>Manual entry</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniStat label="Records" value={String(users.length)} />
            <MiniStat label="With logins" value={String(users.filter((u) => !u.noLogin).length)} />
            <MiniStat label="Holding assets" value={String(new Set(ctx.assets.filter((a) => a.assignedTo).map((a) => a.assignedTo)).size)} />
            <MiniStat label="Entered manually" value={String(users.filter((u) => u.source !== "hrms").length)} />
          </div>
          <div className="mt-3 rounded-lg px-3 py-2 text-[12px]" style={{ background: T.canvas, color: T.sub }}>
            Employee code must be unique — it is the key the HRMS sync will match on later. Use exactly the code your HRMS holds.
          </div>
        </Card>
      )}

      {tab === "users" && (
        <Card pad={false}>
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3" style={{ borderBottom: "1px solid " + T.line }}>
            <span className="text-sm font-semibold">{users.length} people</span>
            <div className="flex gap-2">
              <Btn size="sm" kind="secondary" icon={FileText} onClick={() => setModal("bulk")}>Paste list</Btn>
              <Btn size="sm" icon={Plus} onClick={() => setModal("user")}>Add person</Btn>
            </div>
          </div>
          <div className="p-3" style={{ borderBottom: "1px solid " + T.line }}>
            <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ border: "1px solid " + T.line }}>
              <Search size={16} style={{ color: T.sub }} />
              <input value={peopleQ} onChange={(e) => setPeopleQ(e.target.value)} placeholder="Search name, code or dealership" className="w-full text-sm outline-none" />
            </div>
          </div>
          <div className="divide-y" style={{ borderColor: T.line }}>
            {users.filter((u) => !peopleQ || (u.name + u.empCode + u.title + (ctx.F(u.facilityId)?.name || "")).toLowerCase().includes(peopleQ.toLowerCase())).map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={u.name} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{u.name}</div>
                  <div className="text-[11px]" style={{ color: T.sub }}>
                    <span className="font-mono">{u.empCode}</span> · {u.title}
                  </div>
                  <div className="text-[11px]" style={{ color: T.sub }}>
                    {ctx.D(u.dealershipIds[0])?.name}{u.facilityId ? ` · ${ctx.F(u.facilityId)?.name}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {u.inactive
                    ? <span className="whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium" style={{ color: T.bad, background: T.badBg }}>left</span>
                    : u.noLogin
                    ? <span className="whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium" style={{ color: T.sub, background: T.slateBg }}>no login</span>
                    : <span className="whitespace-nowrap rounded-[4px] px-2 py-0.5 text-[11px] font-medium" style={{ color: T.primary, background: T.primarySoft }}>{u.role.replace("_", " ")}</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {modal === "dealership" && <AddDealership users={users} onClose={() => setModal(null)} onSave={(d) => {
        setDealerships((l) => [...l, { id: "D_" + Date.now(), active: true, territory: d.territory.split(",").map((s) => s.trim()).filter(Boolean), ...d }]);
        onLog("Created dealership", d.code, `${d.name} · ${d.brand}`); notify("Dealership added"); setModal(null);
      }} />}
      {modal === "facility" && <AddFacility dealerships={dealerships} onClose={() => setModal(null)} onSave={(f) => {
        setFacilities((l) => [...l, { id: "F" + Date.now(), active: true, ...f }]);
        onLog("Created facility", f.name, `${f.type} · ${f.district}`); notify("Facility added"); setModal(null);
      }} />}
      {modal === "department" && <AddDepartment users={users} onClose={() => setModal(null)} onSave={(d) => {
        setDepartments((l) => [...l, { id: "DEP_" + Date.now(), active: true, ...d }]);
        onLog("Created department", d.name, d.dualAuthority ? "Dual authority" : "Business Head only"); notify("Department added"); setModal(null);
      }} />}
      {modal === "user" && <AddPerson ctx={ctx} onClose={() => setModal(null)} onSave={(u) => {
        setUsers((l) => [...l, { id: "U_" + Date.now(), source: "manual", ...u }]);
        onLog("Added employee", u.empCode, `${u.name} · ${u.title}`); notify("Employee added"); setModal(null);
      }} />}
      {modal === "bulk" && <BulkPeople ctx={ctx} onClose={() => setModal(null)} onSave={(list) => {
        setUsers((l) => [...l, ...list.map((u, i) => ({ id: "U_" + Date.now() + "_" + i, source: "manual", ...u }))]);
        onLog("Imported employees", `${list.length} records`, list.map((u) => u.empCode).join(", ").slice(0, 120));
        notify(`${list.length} employees added`); setModal(null);
      }} />}
    </div>
  );
}

export function AdminHead({ title, onAdd }) {
  return (
    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid " + T.line }}>
      <span className="text-sm font-semibold">{title}</span>
      <Btn size="sm" icon={Plus} onClick={onAdd}>Add</Btn>
    </div>
  );
}
