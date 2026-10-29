import { useState, useMemo } from "react";
import type { ApprovalSlot, Asset } from "./types";
import {
  LayoutDashboard, Boxes, ShieldCheck, Search, FileText, AlertTriangle, CheckCircle2, Menu, Settings, TrendingUp, Users, Landmark,
} from "lucide-react";
import { SEED_ASSETS, SEED_AUDIT, SEED_DEALERSHIPS, SEED_DEPARTMENTS, SEED_FACILITIES, SEED_REQS, SEED_USERS } from "./data/seed";
import { genAssetCode, mkAsset, parseBundled } from "./domain/assets";
import { aud } from "./domain/audit";
import { paidSoFar } from "./domain/payments";
import { P } from "./domain/permissions";
import { escalation, reqStatus, stageApprover, variance } from "./domain/requisitions";
import { AdminConsole } from "./features/admin/AdminConsole";
import { AssetDetail } from "./features/assets/AssetDetail";
import { AssetList } from "./features/assets/AssetList";
import { CustodyView } from "./features/assets/CustodyView";
import { NewExistingAsset } from "./features/assets/NewExistingAsset";
import { ScanView } from "./features/assets/ScanView";
import { AuditView } from "./features/audit/AuditView";
import { Dashboard } from "./features/dashboard/Dashboard";
import { Escalations } from "./features/escalations/Escalations";
import { Payments } from "./features/payments/Payments";
import { Procurement } from "./features/procurement/Procurement";
import { NewReq } from "./features/requisitions/NewReq";
import { ReqDetail } from "./features/requisitions/ReqDetail";
import { Requisitions } from "./features/requisitions/RequisitionList";
import { Login } from "./features/shell/Login";
import { NotificationBell } from "./features/shell/NotificationBell";
import { RoleSwitcher } from "./features/shell/RoleSwitcher";
import { NavList, ScopeNote } from "./features/shell/Sidebar";
import { inrFull } from "./lib/format";
import { T } from "./theme";

export default function App() {
  const [users, setUsers] = useState(SEED_USERS);
  const [dealerships, setDealerships] = useState(SEED_DEALERSHIPS);
  const [facilities, setFacilities] = useState(SEED_FACILITIES);
  const [departments, setDepartments] = useState(SEED_DEPARTMENTS);
  const [assets, setAssets] = useState(SEED_ASSETS);
  const [reqs, setReqs] = useState(SEED_REQS);
  const [auditLog, setAuditLog] = useState(SEED_AUDIT);

  const [user, setUser] = useState(SEED_USERS[0]);
  const [view, setView] = useState("dashboard");
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);
  const [navOpen, setNavOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  const perm = P(user);
  const U = (id) => users.find((u) => u.id === id);
  const D = (id) => dealerships.find((d) => d.id === id);
  const F = (id) => facilities.find((f) => f.id === id);
  const DEP = (id) => departments.find((d) => d.id === id);

  function notify(m) { setToast(m); setTimeout(() => setToast(null), 2600); }
  function go(v, id = null) { setView(v); setSel(id); setNavOpen(false); }
  function pushAudit(action, ref, detail) {
    setAuditLog((l) => [aud(new Date().toISOString(), user.id, action, ref, detail), ...l]);
  }

  /* -------- scoping -------- */
  const myDealerships = user.dealershipIds || [];
  const visibleReqs = useMemo(() => {
    if (perm.isDirector) return reqs;
    /* Finance function head sees every requisition — money crosses all departments */
    if (perm.isFnHead && user.deptId === "DEP_ACC") return reqs;
    if (perm.isFnHead) return reqs.filter((r) => r.deptId === user.deptId || r.raisedBy === user.id);
    if (perm.isBH) return reqs.filter((r) => myDealerships.includes(r.dealershipId));
    /* Dealership accounts manager: everything approved at their dealership, plus their own */
    if (perm.isAccounts || perm.isExecutive) return reqs.filter((r) => myDealerships.includes(r.dealershipId) && (reqStatus(r) !== "pending" || r.raisedBy === user.id));
    return reqs.filter((r) => r.raisedBy === user.id);
  }, [reqs, user]);

  const visibleAssets = useMemo(() => {
    if (perm.isDirector) return assets;
    if (perm.isFnHead) return assets;
    if (perm.isBH) return assets.filter((a) => myDealerships.includes(a.dealershipId));
    return assets.filter((a) => a.dealershipId === myDealerships[0]);
  }, [assets, user]);

  const ctx = { user, perm, users, dealerships, facilities, departments, assets, U, D, F, DEP, go };

  if (!loggedIn) return <Login onLogin={() => setLoggedIn(true)} />;

  const NAV = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "reqs", label: "Requisitions", icon: FileText },
    ...(perm.canSeePayments ? [{ key: "payments", label: "Payments", icon: Landmark }] : []),
    { key: "assets", label: "Assets", icon: Boxes },
    ...(perm.canAddExisting || perm.isDirector ? [{ key: "scan", label: "Scan", icon: Search }] : []),
    ...(perm.isDirector || perm.isFnHead || perm.isBH ? [{ key: "custody", label: "Custody", icon: Users }] : []),
    ...(perm.canSeeProcurement ? [{ key: "procurement", label: "Procurement", icon: TrendingUp }] : []),
    ...(perm.isDirector || perm.isBH || perm.isFnHead ? [{ key: "escalations", label: "Escalations", icon: AlertTriangle }] : []),
    ...(perm.canSeeAudit ? [{ key: "audit", label: "Audit", icon: ShieldCheck }] : []),
    ...(perm.canAdminConsole ? [{ key: "admin", label: "Admin", icon: Settings }] : []),
  ];

  /* -------- actions -------- */
  function decide(r, slot, decision, note) {
    const esc = escalation(r);
    const steppingIn = perm.isDirector && esc && esc.stage === slot;
    const ownerId = steppingIn ? stageApprover(r, slot, dealerships, departments) : null;
    const entry: ApprovalSlot = { decision, by: user.id, at: new Date().toISOString(), note: note || "" };
    if (steppingIn && ownerId && ownerId !== user.id) { entry.onBehalfOf = ownerId; entry.lateDays = esc.days; }
    setReqs((all) => all.map((x) => x.id === r.id ? { ...x, [slot]: entry } : x));
    const who = slot === "bh" ? "business head" : slot === "directorPurchase" ? "Director, purchase" : "functional";
    pushAudit(`${decision === "approved" ? "Approved" : "Rejected"} requisition (${who})`, r.ref,
      `${D(r.dealershipId).name} · ${r.item}${entry.onBehalfOf ? ` — Director acted in place of ${U(entry.onBehalfOf)?.name} after ${esc.days} days` : ""}${note ? " — " + note : ""}`);
    notify(decision === "approved" ? "Approval recorded" : "Requisition rejected");
  }

  function financeSignoff(r, decision, note) {
    stageSignoff(r, "financeApproval", decision, note, "payment sign-off (GM Finance)", r.procurement.actualCost - paidSoFar(r));
  }
  function advanceEscalation(r, field, decision, note) {
    stageSignoff(r, field, decision, note,
      field === "advanceFinance" ? "advance (GM Finance)" : "advance (Director)", r.advance.amount);
  }

  function approveAdvance(r, decision, note) {
    setReqs((all) => all.map((x) => x.id === r.id ? { ...x, advanceApproval: { decision, by: user.id, at: new Date().toISOString(), note: note || "" } } : x));
    pushAudit(decision === "approved" ? "Approved advance for payment" : "Held advance", r.ref,
      `${D(r.dealershipId).name} · ${inrFull(r.advance.amount)} advance${note ? " — " + note : ""}`);
    notify(decision === "approved" ? "Advance approved — sent to accounts for payment" : "Advance held");
  }

  function verifyEntry(r, decision, note) {
    const now = new Date().toISOString();
    if (decision === "verified") {
      setReqs((all) => all.map((x) => x.id === r.id ? { ...x, procurement: { ...x.procurement, verification: { decision, by: user.id, at: now, note: note || "" } } } : x));
      setAssets((as) => as.map((a) => r.procurement.assetCodes.includes(a.code) ? { ...a, verified: true } : a));
      pushAudit("Verified asset entry", r.ref, `${r.procurement.assetCodes.length} asset(s) · ${inrFull(r.procurement.actualCost)} confirmed against invoice`);
      notify("Asset entry verified");
    } else {
      /* Sent back: remove the provisional assets so the register stays clean, and reopen for re-entry */
      const codes = r.procurement.assetCodes;
      setAssets((as) => as.filter((a) => !codes.includes(a.code)));
      setReqs((all) => all.map((x) => x.id === r.id ? { ...x, procurement: null, sentBack: { by: user.id, at: now, note: note || "" } } : x));
      pushAudit("Sent asset entry back", r.ref, note || "Details did not match the invoice");
      notify("Sent back for correction");
    }
  }

  function varianceApprove(r, decision, note) {
    const v = variance(r);
    stageSignoff(r, "varianceApproval", decision, note,
      `cost overrun of ${v.pct.toFixed(0)}% (Director)`, r.procurement.actualCost);
  }

  function resubmit(r, draft) {
    const ref = `REQ-2026-${String(40 + reqs.length).padStart(4, "0")}`;
    const nr = {
      id: "R" + Date.now(), ref, revisionOf: r.ref,
      payments: { advance: null, balance: null },
      advance: { required: false, amount: 0, terms: "" },
      ...draft, raisedBy: user.id, raisedAt: new Date().toISOString(),
      bh: { decision: null }, fn: { decision: null }, procurement: null,
    };
    setReqs((all) => [nr, ...all.map((x) => x.id === r.id ? { ...x, resubmittedAs: ref } : x)]);
    pushAudit("Resubmitted requisition", ref, `Revision of ${r.ref} · ${draft.item} · est. ${inrFull(draft.estCost)}`);
    notify("Revised requisition raised"); go("reqdetail", nr.id);
  }

  function stageSignoff(r, field, decision, note, label, amount) {
    setReqs((all) => all.map((x) => x.id === r.id ? { ...x, [field]: { decision, by: user.id, at: new Date().toISOString(), note: note || "" } } : x));
    pushAudit(`${decision === "approved" ? "Approved" : "Held"} ${label}`, r.ref,
      `${D(r.dealershipId).name} · ${inrFull(amount)}${note ? " — " + note : ""}`);
    notify(decision === "approved" ? "Approval recorded" : "Held");
  }

  function directorSignoff(r, decision, note) {
    stageSignoff(r, "directorApproval", decision, note, "final payment (Director)", r.procurement.actualCost - paidSoFar(r));
  }

  function releasePayment(r, kind, form) {
    setReqs((all) => all.map((x) => x.id === r.id ? {
      ...x, payments: { ...(x.payments || { advance: null, balance: null }),
        [kind]: { by: user.id, at: new Date().toISOString(), amount: Number(form.amount), mode: form.mode, ref: form.ref } },
    } : x));
    pushAudit(kind === "advance" ? "Paid vendor advance" : "Paid balance", r.ref,
      `${inrFull(form.amount)} · ${form.mode} · ${form.ref} · ${D(r.dealershipId).name}`);
    notify(kind === "advance" ? "Advance released" : "Balance payment released");
  }

  function procure(r, form) {
    const codes = [];
    let pool: Pick<Asset, "code">[] = assets;
    const created = form.assets.map((a) => {
      const code = genAssetCode(pool, dealerships, r.dealershipId, a.category, form.date);
      pool = [...pool, { code }];
      codes.push(code);
      return mkAsset({
        code, name: a.name, category: a.category, make: a.make, model: a.model, serial: a.serial,
        purchaseDate: form.date, cost: Number(a.cost), vendor: form.vendor,
        dealershipId: r.dealershipId, facilityId: r.facilityId, deptId: r.deptId,
        warranty: a.warranty || null, source: "procured", reqRef: r.ref,
        assignedTo: a.assignedTo || null,
        accessories: parseBundled(a.bundled, form.date),
        verified: user.role === "functional_head",
      });
    });
    const total = created.reduce((s, x) => s + x.cost, 0);
    setAssets((as) => [...created, ...as]);
    const selfVerified = user.role === "functional_head";
    setReqs((all) => all.map((x) => x.id === r.id ? { ...x, procurement: {
      by: user.id, at: new Date().toISOString(), actualCost: total,
      vendor: form.vendor, invoice: form.invoice, assetCodes: codes,
      invoiceDoc: form.invoiceDoc || null,
      verification: selfVerified
        ? { decision: "verified", by: user.id, at: new Date().toISOString(), note: "Entered and verified by the functional head." }
        : null,
    } } : x));
    pushAudit(selfVerified ? "Procured requisition" : "Entered procured assets — awaiting verification", r.ref,
      `${created.length} asset(s) · ${inrFull(total)} · ${form.vendor}`);
    notify(selfVerified ? "Procurement recorded" : "Entered — sent for verification");
  }

  return (
    <div className="min-h-screen w-full" style={{ background: T.canvas, color: T.ink, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 md:px-6" style={{ background: T.surface, borderBottom: "1px solid " + T.line }}>
        <div className="flex items-center gap-3">
          <button className="md:hidden" onClick={() => setNavOpen(true)} style={{ color: T.ink }}><Menu size={22} /></button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg font-black text-white" style={{ background: T.primary }}>R</div>
            <div className="leading-tight">
              <div className="text-sm font-bold">Ratnapprabbha World</div>
              <div className="text-[11px]" style={{ color: T.sub }}>Assets & Procurement</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell ctx={ctx} reqs={visibleReqs} go={go} />
          <RoleSwitcher users={users} user={user} onChange={(u) => { setUser(u); go("dashboard"); }} />
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        <aside className="hidden w-56 shrink-0 px-3 py-5 md:block">
          <NavList nav={NAV} view={view} go={go} />
          <ScopeNote user={user} D={D} DEP={DEP} />
        </aside>

        {navOpen && (
          <div className="fixed inset-0 z-40 md:hidden" style={{ background: "rgba(16,32,46,.45)" }} onClick={() => setNavOpen(false)}>
            <div className="h-full w-64 px-3 py-5" style={{ background: T.surface }} onClick={(e) => e.stopPropagation()}>
              <NavList nav={NAV} view={view} go={go} />
              <ScopeNote user={user} D={D} DEP={DEP} />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-5 pb-24 md:px-6 md:pb-8">
          {view === "dashboard" && <Dashboard ctx={ctx} reqs={visibleReqs} assets={visibleAssets} />}
          {view === "reqs" && <Requisitions ctx={ctx} reqs={visibleReqs} />}
          {view === "reqdetail" && <ReqDetail ctx={ctx} r={reqs.find((x) => x.id === sel)} onDecide={decide} onProcure={procure} onPay={releasePayment} onFinance={financeSignoff} onDirector={directorSignoff} onAdvanceApprove={approveAdvance} onAdvanceEscalate={advanceEscalation} onVariance={varianceApprove} onVerify={verifyEntry} onResubmit={(d) => resubmit(reqs.find((x) => x.id === sel), d)} assets={assets} />}
          {view === "payments" && <Payments ctx={ctx} reqs={visibleReqs} />}
          {view === "newreq" && <NewReq ctx={ctx} onCancel={() => go("reqs")} onCreate={(draft) => {
            const ref = `REQ-2026-${String(35 + reqs.length).padStart(4, "0")}`;
            const nr = { id: "R" + Date.now(), ref, payments: { advance: null, balance: null }, advance: { required: false, amount: 0, terms: "" }, ...draft, raisedBy: user.id, raisedAt: new Date().toISOString(), bh: { decision: null }, fn: { decision: null }, procurement: null };
            setReqs((a) => [nr, ...a]);
            pushAudit("Raised requisition", ref, `${D(draft.dealershipId).name} · ${draft.item} · est. ${inrFull(draft.estCost)}`);
            notify("Requisition raised"); go("reqdetail", nr.id);
          }} />}
          {view === "assets" && <AssetList ctx={ctx} assets={visibleAssets} />}
          {view === "assetdetail" && <AssetDetail ctx={ctx} a={assets.find((x) => x.id === sel)} reqs={reqs} auditLog={auditLog}
            onIssue={(d) => {
              const a = assets.find((x) => x.id === sel);
              const now = new Date().toISOString();
              setAssets((as) => as.map((x) => x.id === sel ? {
                ...x, assignedTo: d.who, issuedBy: user.id, issuedAt: now, returnRecord: null,
                acceptance: d.method === "signature"
                  ? { method: "signature", at: now, signature: d.signature, snapshot: d.snapshot, note: d.note }
                  : null,
              } : x));
              pushAudit(d.method === "signature" ? "Issued asset — signed at handover" : "Issued asset — acceptance pending",
                a.code, `${U(d.who)?.name} (${U(d.who)?.empCode}) · ${d.snapshot.length} item(s)`);
              notify(d.method === "signature" ? "Handover recorded" : "Sent for acceptance");
            }}
            onAccept={() => {
              const a = assets.find((x) => x.id === sel);
              const now = new Date().toISOString();
              const snapshot = [a.name, ...(a.accessories || []).map((x) => x.name)];
              setAssets((as) => as.map((x) => x.id === sel ? { ...x, acceptance: { method: "in_app", at: now, snapshot } } : x));
              pushAudit("Asset receipt accepted", a.code, `${user.name} confirmed ${snapshot.length} item(s) in app`);
              notify("Receipt confirmed");
            }}
            onReturn={(d) => {
              const a = assets.find((x) => x.id === sel);
              const now = new Date().toISOString();
              setAssets((as) => as.map((x) => x.id === sel ? {
                ...x, assignedTo: null, acceptance: null,
                returnRecord: { at: now, receivedBy: user.id, signature: d.signature, condition: d.condition, missing: d.missing, from: x.assignedTo },
              } : x));
              pushAudit("Asset returned", a.code,
                `From ${U(a.assignedTo)?.name} · ${d.condition}${d.missing.length ? ` · not returned: ${d.missing.join(", ")}` : ""}`);
              notify(d.missing.length ? "Return recorded with missing items" : "Return recorded");
            }}
            onAddAccessory={(acc) => {
              const a = assets.find((x) => x.id === sel);
              setAssets((as) => as.map((x) => x.id === sel ? { ...x, accessories: [...(x.accessories || []), { ...acc, status: "with_asset" }] } : x));
              pushAudit("Added accessory", a.code, `${acc.name} · ${acc.origin === "bundled" ? "bundled with asset" : `${inrFull(acc.cost)} expensed`}`);
              notify("Accessory added");
            }}
            onDispose={(reason, scrap) => {
              const a = assets.find((x) => x.id === sel);
              setAssets((as) => as.map((x) => x.id === sel ? { ...x, status: "disposed", assignedTo: null } : x));
              pushAudit("Disposed asset", a.code, `${reason}${scrap ? " · scrap " + inrFull(scrap) : ""}`);
              notify("Asset written off");
            }} />}
          {view === "newasset" && <NewExistingAsset ctx={ctx} onCancel={() => go("assets")} onCreate={(draft) => {
            const created = mkAsset({ ...draft, source: "existing" });
            setAssets((as) => [created, ...as]);
            pushAudit("Added existing asset", created.code, `Opening stock · ${inrFull(created.cost)} · ${D(created.dealershipId).name}`);
            notify("Existing asset added"); go("assetdetail", created.id);
          }} />}
          {view === "procurement" && <Procurement ctx={ctx} reqs={visibleReqs} assets={assets} />}
          {view === "escalations" && <Escalations ctx={ctx} reqs={perm.isDirector ? reqs : reqs} />}
          {view === "scan" && <ScanView ctx={ctx} assets={assets} />}
          {view === "custody" && <CustodyView ctx={ctx} assets={visibleAssets} />}
          {view === "audit" && <AuditView ctx={ctx} auditLog={auditLog} />}
          {view === "admin" && perm.canAdminConsole && (
            <AdminConsole ctx={ctx}
              setDealerships={setDealerships} setFacilities={setFacilities} setDepartments={setDepartments} setUsers={setUsers}
              onLog={(action, ref, detail) => pushAudit(action, ref, detail)} notify={notify} />
          )}
        </main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden" style={{ background: T.surface, borderTop: "1px solid " + T.line }}>
        {NAV.slice(0, 5).map((n) => (
          <button key={n.key} onClick={() => go(n.key)} className="flex flex-1 flex-col items-center gap-0.5 py-2.5" style={{ color: view === n.key ? T.primary : T.sub }}>
            <n.icon size={19} /><span className="text-[10px] font-semibold">{n.label}</span>
          </button>
        ))}
      </nav>

      {toast && (
        <div className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg md:bottom-6" style={{ background: T.ink }}>
          <CheckCircle2 size={16} style={{ color: "#7EE0A8" }} />{toast}
        </div>
      )}
    </div>
  );
}
