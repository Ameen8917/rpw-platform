import { useCallback, useEffect, useState } from "react";
import type { Asset, Department, Dealership, Facility, Requisition, User } from "./types";
import {
  LayoutDashboard, Boxes, ShieldCheck, Search, FileText, AlertTriangle, CheckCircle2, Menu, Settings, TrendingUp, Users, Landmark, RefreshCw,
} from "lucide-react";
import { Btn } from "./components/ui";
import { LIMITS } from "./domain/config";
import type { Permissions } from "./domain/permissions";
import { AdminConsole } from "./features/admin/AdminConsole";
import { assetApi, orgApi, toCreateBody } from "./features/assets/api";
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
import { reqApi, settingsApi, toProcureBody, toRaiseBody, type StageDecision, type StageKey } from "./features/requisitions/api";
import { Login } from "./features/shell/Login";
import { NotificationBell } from "./features/shell/NotificationBell";
import { RoleSwitcher } from "./features/shell/RoleSwitcher";
import { sessionApi, useSession, type DevUser, type SessionInfo } from "./features/shell/session";
import { Brand, NavList, ScopeNote } from "./features/shell/Sidebar";
import { errorMessage } from "./lib/api";
import { TODAY, fmtDate } from "./lib/format";
import { T } from "./theme";

type Toast = { msg: string; kind: "ok" | "error" } | null;

/* Sign-in gate. Everything comes from the API: organisation data, group limits, and the assets and
   requisitions the signed-in person may see (the server scopes both). */
export default function App() {
  const { state, signedIn, logout } = useSession();
  const [reqs, setReqs] = useState<Requisition[] | null>(null);
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

  const applyOrg = (org: Awaited<ReturnType<typeof orgApi.load>>) => {
    setUsers(org.users); setDealerships(org.dealerships); setFacilities(org.facilities); setDepartments(org.departments);
    setOrgLoaded(true);
  };

  /* Everything for the person who signs in. The group limits are written into LIMITS, which the
     shared rules (reqStatus, payStatus, escalation) read. */
  const load = useCallback(async () => {
    setLoadError(null);
    setAssets(null);
    setReqs(null);
    try {
      const [org, register, requisitions, limits, dev] = await Promise.all([
        orgApi.load(), assetApi.list(), reqApi.list(), settingsApi.get(), sessionApi.devUsers(),
      ]);
      Object.assign(LIMITS, limits);
      applyOrg(org);
      setDevUsers(dev);
      setAssets(register);
      setReqs(requisitions);
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }, []);

  /* After an Admin console change: the directory, the limits, and the requisitions whose approvers it moves */
  const reloadOrg = useCallback(async () => {
    const [org, requisitions, limits] = await Promise.all([orgApi.load(), reqApi.list(), settingsApi.get()]);
    Object.assign(LIMITS, limits);
    applyOrg(org);
    setReqs(requisitions);
  }, []);

  useEffect(() => {
    if (userId) load();
    else { setAssets(null); setReqs(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload per person, not when org data arrives
  }, [userId]);

  if (state.status === "loading") return <Splash msg="Loading…" />;
  if (state.status === "signedOut") return <Login onSignedIn={signedIn} expired={state.expired} />;
  if (loadError) return <Splash msg={`Could not load your data: ${loadError}`} onRetry={load} onSignOut={logout} />;
  if (!orgLoaded || !assets || !reqs) return <Splash msg="Loading your workspace…" />;

  return (
    <Workspace key={session.user.id} session={session} devUsers={devUsers}
      onSwitchUser={signedIn} onSignOut={logout}
      org={{ users, dealerships, facilities, departments, reload: reloadOrg }}
      assets={assets} setAssets={setAssets} reqs={reqs} setReqs={setReqs} />
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
    reload: () => Promise<void>;
  };
  assets: Asset[];
  setAssets: (fn: (as: Asset[]) => Asset[]) => void;
  reqs: Requisition[];
  setReqs: (fn: (rs: Requisition[]) => Requisition[]) => void;
}

function Workspace({ session, devUsers, onSwitchUser, onSignOut, org, assets, setAssets, reqs, setReqs }: WorkspaceProps) {
  const { users, dealerships, facilities, departments } = org;
  const user = session.user;
  const perm: Permissions = session.permissions;
  const [view, setView] = useState("dashboard");
  const [sel, setSel] = useState(null);
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
  function go(v, id = null) { setView(v); setSel(id); setNavOpen(false); }
  /* The server's answer replaces the asset in the register (or adds it) */
  function upsertAsset(a: Asset) {
    setAssets((as) => (as.some((x) => x.id === a.id) ? as.map((x) => (x.id === a.id ? a : x)) : [a, ...as]));
  }
  function upsertReq(r: Requisition) {
    setReqs((rs) => (rs.some((x) => x.id === r.id) ? rs.map((x) => (x.id === r.id ? r : x)) : [r, ...rs]));
  }
  async function onSwitchTo(u: User) {
    try {
      onSwitchUser(await sessionApi.loginAs(u.id));
    } catch (err) {
      notify(errorMessage(err), "error");
    }
  }

  /* The server already limits requisitions and the register to what this person may see */
  const visibleReqs = reqs;
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

  /* -------- actions --------
     Each goes to the server, which checks who may take it and answers with the updated
     requisition. They resolve true when saved, so a dialog can close; false keeps it open. */
  async function act(work: () => Promise<Requisition>, msg: string) {
    try {
      upsertReq(await work());
      notify(msg);
      return true;
    } catch (err) {
      notify(errorMessage(err), "error");
      return false;
    }
  }

  const decide = (r: Requisition, stage: StageKey, decision: StageDecision, note: string) =>
    act(() => reqApi.decide(r.id, stage, decision, note), {
      approved: "Approval recorded", rejected: "Requisition rejected", held: "Held", queried: "Query sent",
    }[decision]);

  /* A functional head checks a manager's asset entry; sending it back removes its assets */
  async function verifyEntry(r: Requisition, decision: "verified" | "sent_back", note: string) {
    const codes = r.procurement?.assetCodes ?? [];
    const ok = await act(() => reqApi.verify(r.id, decision, note), decision === "verified" ? "Asset entry verified" : "Sent back for correction");
    if (ok && decision === "verified") setAssets((as) => as.map((x) => (codes.includes(x.code) ? { ...x, verified: true } : x)));
    if (ok && decision === "sent_back") setAssets((as) => as.filter((x) => !codes.includes(x.code)));
    return ok;
  }

  const releasePayment = (r: Requisition, kind: "advance" | "balance", form) =>
    act(() => reqApi.pay(r.id, kind, form), kind === "advance" ? "Advance released" : "Balance payment released");

  async function procure(r: Requisition, form) {
    try {
      const res = await reqApi.procure(r.id, toProcureBody(form));
      setAssets((as) => [...res.assets, ...as]);
      upsertReq(res.requisition);
      notify(res.requisition.procurement?.verification ? "Procurement recorded" : "Entered — sent for verification");
      return true;
    } catch (err) {
      notify(errorMessage(err), "error");
      return false;
    }
  }

  async function raise(draft) {
    try {
      const created = await reqApi.raise(toRaiseBody(draft));
      upsertReq(created);
      notify("Requisition raised"); go("reqdetail", created.id);
    } catch (err) {
      notify(errorMessage(err), "error");
    }
  }

  async function resubmit(r: Requisition, draft) {
    try {
      const created = await reqApi.resubmit(r.id, draft);
      upsertReq({ ...r, resubmittedAs: created.ref });
      upsertReq(created);
      notify("Revised requisition raised"); go("reqdetail", created.id);
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
          {view === "reqdetail" && <ReqDetail key={sel} ctx={ctx} r={reqs.find((x) => x.id === sel)} onDecide={decide} onProcure={procure} onPay={releasePayment} onVerify={verifyEntry} onResubmit={(d) => resubmit(reqs.find((x) => x.id === sel), d)} assets={assets} />}
          {view === "payments" && <Payments ctx={ctx} reqs={visibleReqs} />}
          {view === "newreq" && <NewReq ctx={ctx} onCancel={() => go("reqs")} onCreate={raise} />}
          {view === "assets" && <AssetList ctx={ctx} assets={visibleAssets} />}
          {view === "assetdetail" && <AssetDetailPage key={sel} ctx={ctx} assetId={sel} reqs={reqs} auditLog={[]} notify={notify} onChanged={upsertAsset} />}
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
          {view === "escalations" && <Escalations ctx={ctx} reqs={visibleReqs} />}
          {view === "scan" && <ScanView ctx={ctx} assets={assets} />}
          {view === "custody" && <CustodyView ctx={ctx} assets={visibleAssets} />}
          {view === "audit" && <AuditView ctx={ctx} />}
          {view === "admin" && perm.canAdminConsole && (
            <AdminConsole ctx={ctx} onChanged={org.reload} notify={notify} />
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
