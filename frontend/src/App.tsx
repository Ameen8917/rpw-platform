import { useCallback, useEffect, useMemo, useState } from "react";
import type { ApprovalSlot, Asset, AuditEntry, Department, Dealership, Facility, Requisition, User } from "./types";
import {
  LayoutDashboard, Boxes, ShieldCheck, Search, FileText, AlertTriangle, CheckCircle2, Menu, Settings, TrendingUp, Users, Landmark, RefreshCw,
} from "lucide-react";
import { Btn } from "./components/ui";
import { SEED_REQS } from "./data/seed";
import { aud } from "./domain/audit";
import { paidSoFar } from "./domain/payments";
import type { Permissions } from "./domain/permissions";
import { escalation, reqStatus, stageApprover, variance } from "./domain/requisitions";
import { AdminConsole } from "./features/admin/AdminConsole";
import { assetApi, orgApi, toCreateBody, toProcuredBody } from "./features/assets/api";
import { AssetDetailPage } from "./features/assets/AssetDetailPage";
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
import { useHashRoute } from "./features/shell/route";
import { sessionApi, useSession, type DevUser, type SessionInfo } from "./features/shell/session";
import { Brand, NavList, ScopeNote } from "./features/shell/Sidebar";
import { errorMessage } from "./lib/api";
import { TODAY, fmtDate, inrFull } from "./lib/format";
import { T } from "./theme";

type Toast = { msg: string; kind: "ok" | "error" } | null;

/* Sign-in gate. Organisation data and assets come from the API; requisitions, payments and their
   audit steps are still held here in memory, and are kept across "sign in as" so one person's
   requisition can be approved by the next. */
export default function App() {
  const { state, signedIn, logout } = useSession();
  const [reqs, setReqs] = useState<Requisition[]>(SEED_REQS);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [dealerships, setDealerships] = useState<Dealership[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [orgLoaded, setOrgLoaded] = useState(false);
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [devUsers, setDevUsers] = useState<DevUser[]>([]);

  const session = state.status === "signedIn" ? state.session : null;
  const userId = session?.user.id ?? null;

  /* Org data once (Admin edits it in memory), the asset register for every person who signs in */
  const load = useCallback(async () => {
    setLoadError(null);
    setAssets(null);
    try {
      const [org, register, dev] = await Promise.all([
        orgLoaded ? null : orgApi.load(), assetApi.list(), sessionApi.devUsers(),
      ]);
      if (org) {
        setUsers(org.users); setDealerships(org.dealerships); setFacilities(org.facilities); setDepartments(org.departments);
        setOrgLoaded(true);
      }
      setDevUsers(dev);
      setAssets(register);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, [orgLoaded]);

  useEffect(() => {
    if (userId) load();
    else setAssets(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload per person, not when org data arrives
  }, [userId]);

  if (state.status === "loading") return <Splash msg="Loading…" />;
  if (state.status === "signedOut") return <Login onSignedIn={signedIn} expired={state.expired} />;
  if (loadError) return <Splash msg={`Could not load your data: ${loadError}`} onRetry={load} onSignOut={logout} />;
  if (!orgLoaded || !assets) return <Splash msg="Loading your workspace…" />;

  return (
    <Workspace key={session.user.id} session={session} devUsers={devUsers}
      onSwitchUser={signedIn} onSignOut={logout}
      org={{ users, dealerships, facilities, departments, setUsers, setDealerships, setFacilities, setDepartments }}
      assets={assets} setAssets={setAssets} reqs={reqs} setReqs={setReqs} auditLog={auditLog} setAuditLog={setAuditLog} />
  );
}

function Splash({ msg, onRetry, onSignOut }: { msg: string; onRetry?: () => void; onSignOut?: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-5 text-center" style={{ background: T.canvas, color: T.ink }}>
      <Brand />
      <p className="max-w-sm text-sm" style={{ color: onRetry ? T.bad : T.sub }}>{msg}</p>
      {onRetry && (
        <div className="flex gap-2">
          <Btn size="sm" icon={RefreshCw} onClick={onRetry}>Try again</Btn>
          {onSignOut && <Btn size="sm" kind="ghost" onClick={onSignOut}>Sign out</Btn>}
        </div>
      )}
    </div>
  );
}

interface WorkspaceProps {
  session: SessionInfo;
  devUsers: DevUser[];
  onSwitchUser: (s: SessionInfo) => void;
  onSignOut: () => void;
  org: {
    users: User[]; dealerships: Dealership[]; facilities: Facility[]; departments: Department[];
    setUsers; setDealerships; setFacilities; setDepartments;
  };
  assets: Asset[];
  setAssets: (fn: (as: Asset[]) => Asset[]) => void;
  reqs: Requisition[];
  setReqs;
  auditLog: AuditEntry[];
  setAuditLog;
}

function Workspace({ session, devUsers, onSwitchUser, onSignOut, org, assets, setAssets, reqs, setReqs, auditLog, setAuditLog }: WorkspaceProps) {
  const { users, dealerships, facilities, departments, setUsers, setDealerships, setFacilities, setDepartments } = org;
  const user = session.user;
  const perm: Permissions = session.permissions;
  const [route, navigate] = useHashRoute();
  const sel = route.id;
  const [toast, setToast] = useState<Toast>(null);
  const [navOpen, setNavOpen] = useState(false);

  const U = (id) => users.find((u) => u.id === id);
  const D = (id) => dealerships.find((d) => d.id === id);
  const F = (id) => facilities.find((f) => f.id === id);
  const DEP = (id) => departments.find((d) => d.id === id);

  function notify(msg: string, kind: "ok" | "error" = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast((t) => (t?.msg === msg ? null : t)), kind === "error" ? 6000 : 2600);
  }
  function go(v, id = null) { navigate({ view: v, id }); setNavOpen(false); }
  function pushAudit(action, ref, detail) {
    setAuditLog((l) => [aud(new Date().toISOString(), user.id, action, ref, detail), ...l]);
  }
  /* The server's answer replaces the asset in the register (or adds it) */
  function upsertAsset(a: Asset) {
    setAssets((as) => (as.some((x) => x.id === a.id) ? as.map((x) => (x.id === a.id ? a : x)) : [a, ...as]));
  }
  async function onSwitchTo(u: User) {
    try {
      onSwitchUser(await sessionApi.loginAs(u.id));
    } catch (err) {
      notify(errorMessage(err), "error");
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqs, user]);

  /* The server already limits the register to what this person may see */
  const visibleAssets = assets;

  const ctx = { user, perm, users, dealerships, facilities, departments, assets, U, D, F, DEP, go };

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
  /* A page from the URL this user may not open (or a requisition lost on reload, as they live in memory) shows the dashboard */
  const known = [...NAV.map((n) => n.key), "reqdetail", "newreq", "assetdetail", "newasset"].includes(route.view);
  const view = !known || (route.view === "reqdetail" && !reqs.some((x) => x.id === sel)) ? "dashboard" : route.view;

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

  /* Not reachable yet (ReqDetail does not wire onVerify), and not saved: verification and
     "send back" move to the server with the Requisitions backend */
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

  /* Saved through the API (one asset per line, codes from the server); the requisition itself
     is still in memory. Resolves true when saved, so the dialog can close. */
  async function procure(r, form) {
    try {
      const res = await assetApi.procure(toProcuredBody(r, form));
      setAssets((as) => [...res.assets, ...as]);
      setReqs((all) => all.map((x) => x.id === r.id ? { ...x, procurement: {
        by: res.by, at: res.at, actualCost: res.actualCost,
        vendor: res.vendor, invoice: res.invoice, assetCodes: res.assetCodes,
        invoiceDoc: form.invoiceDoc || null,
        verification: res.verified
          ? { decision: "verified", by: res.by, at: res.at, note: "Entered and verified by the functional head." }
          : null,
      } } : x));
      notify(res.verified ? "Procurement recorded" : "Entered — sent for verification");
      return true;
    } catch (err) {
      notify(errorMessage(err), "error");
      return false;
    }
  }

  return (
    <div className="min-h-screen w-full" style={{ background: T.canvas, color: T.ink }}>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col px-3 py-5 md:flex" style={{ background: T.rail }}>
        <div className="px-3 pb-7"><Brand dark /></div>
        <div className="min-h-0 flex-1 overflow-y-auto"><NavList nav={NAV} view={view} go={go} /></div>
        <ScopeNote user={user} D={D} DEP={DEP} />
      </aside>

      {navOpen && (
        <div className="fixed inset-0 z-40 md:hidden" style={{ background: "rgba(18,18,20,.5)" }} onClick={() => setNavOpen(false)}>
          <div className="flex h-full w-64 flex-col px-3 py-5" style={{ background: T.rail }} onClick={(e) => e.stopPropagation()}>
            <div className="px-3 pb-6"><Brand dark /></div>
            <div className="min-h-0 flex-1 overflow-y-auto"><NavList nav={NAV} view={view} go={go} /></div>
            <ScopeNote user={user} D={D} DEP={DEP} />
          </div>
        </div>
      )}

      <div className="md:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 px-4 md:px-8"
          style={{ background: "rgba(244,243,240,.86)", backdropFilter: "saturate(1.4) blur(10px)", borderBottom: "1px solid " + T.line }}>
          <div className="flex items-center gap-3 md:hidden">
            <button onClick={() => setNavOpen(true)} aria-label="Open menu" className="-ml-1 rounded-md p-1" style={{ color: T.ink }}><Menu size={20} /></button>
            <Brand />
          </div>
          <div className="hidden text-[12px] md:block" style={{ color: T.sub }}>{fmtDate(TODAY.toISOString())}</div>
          <div className="flex items-center gap-1.5">
            <NotificationBell ctx={ctx} reqs={visibleReqs} go={go} />
            <RoleSwitcher users={devUsers} user={user} onChange={onSwitchTo} onSignOut={onSignOut} />
          </div>
        </header>

        <main className="mx-auto min-w-0 max-w-6xl px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-12">
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
          {view === "assetdetail" && <AssetDetailPage key={sel} ctx={ctx} assetId={sel} reqs={reqs} auditLog={auditLog} notify={notify} onChanged={upsertAsset} />}
          {view === "newasset" && <NewExistingAsset ctx={ctx} onCancel={() => go("assets")} onCreate={async (draft) => {
            try {
              const created = await assetApi.create(toCreateBody(draft));
              upsertAsset(created);
              notify("Existing asset added"); go("assetdetail", created.id);
            } catch (err) {
              notify(errorMessage(err), "error");
            }
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
          <button key={n.key} onClick={() => go(n.key)} className="flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5" style={{ color: view === n.key ? T.primary : T.sub }}>
            <n.icon size={19} strokeWidth={view === n.key ? 2 : 1.6} /><span className="text-[10px] font-medium">{n.label}</span>
          </button>
        ))}
      </nav>

      {toast && (
        <div role={toast.kind === "error" ? "alert" : "status"} className="fixed bottom-20 left-1/2 z-50 flex max-w-[calc(100vw-32px)] -translate-x-1/2 items-center gap-2.5 rounded-md px-4 py-2.5 text-[13px] font-medium text-white shadow-xl md:bottom-6 md:left-[calc(50%+120px)]"
          style={{ background: toast.kind === "error" ? T.bad : T.rail }}>
          {toast.kind === "error" ? <AlertTriangle size={16} className="shrink-0" /> : <CheckCircle2 size={16} className="shrink-0" style={{ color: "#9CC9A8" }} />}{toast.msg}
        </div>
      )}
    </div>
  );
}
