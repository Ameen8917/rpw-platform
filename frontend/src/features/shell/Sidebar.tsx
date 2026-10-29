import {
  ShieldCheck,
} from "lucide-react";
import { T } from "../../theme";

export function NavList({ nav, view, go }) {
  return (
    <nav className="space-y-1">
      {nav.map((n) => (
        <button key={n.key} onClick={() => go(n.key)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold"
          style={view === n.key ? { background: T.primarySoft, color: T.primary } : { color: T.sub }}>
          <n.icon size={18} />{n.label}
        </button>
      ))}
    </nav>
  );
}

export function ScopeNote({ user, D, DEP }) {
  const line =
    user.role === "director" ? "Full group visibility"
    : user.role === "functional_head" ? `${DEP(user.deptId)?.name} function — all dealerships`
    : user.role === "business_head" ? user.dealershipIds.map((d) => D(d).name).join(" · ")
    : `${DEP(user.deptId)?.name} · ${D(user.dealershipIds[0]).name}`;
  return (
    <div className="mt-5 rounded-lg px-3 py-3" style={{ background: T.primarySoft }}>
      <div className="flex items-center gap-2 text-xs font-bold" style={{ color: T.primary }}><ShieldCheck size={14} />{user.title}</div>
      <p className="mt-1 text-[11px] leading-snug" style={{ color: T.sub }}>{line}</p>
    </div>
  );
}
