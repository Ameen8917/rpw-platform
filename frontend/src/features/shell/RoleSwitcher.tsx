import { useState } from "react";
import {
  ChevronRight, LogOut,
} from "lucide-react";
import { Avatar } from "../../components/ui";
import { T } from "../../theme";

/* The signed-in user's menu. `users` are the people offered by the development "sign in as"
   (empty unless the backend enables it); signing out is always available. */
export function RoleSwitcher({ users, user, onChange, onSignOut }) {
  const [open, setOpen] = useState(false);
  const groups = [["Director", "director"], ["Corporate functions", "functional_head"], ["Business Heads", "business_head"], ["Dealership managers", "manager"], ["Accounts executives", "accounts_executive"]];
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 rounded-md py-1 pl-1 pr-2 hover:bg-black/[0.05]">
        <Avatar name={user.name} size={30} />
        <div className="hidden text-left leading-tight sm:block">
          <div className="text-[13px] font-medium">{user.name}</div>
          <div className="text-[10px]" style={{ color: T.sub }}>{user.title}</div>
        </div>
        <ChevronRight size={14} className="rotate-90" style={{ color: T.sub }} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 max-h-[70vh] w-72 overflow-y-auto rounded-lg py-2 shadow-xl" style={{ background: T.surface, border: "1px solid " + T.line, WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
            <button onClick={() => { setOpen(false); onSignOut(); }} className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm font-semibold hover:bg-slate-50" style={{ color: T.bad }}>
              <LogOut size={16} />Sign out
            </button>
            {users.length > 0 && <div className="mx-3 mt-1 border-t pt-1 text-[10px] font-semibold uppercase tracking-wide" style={{ borderColor: T.line, color: T.warn }}>Development — sign in as</div>}
            {users.length > 0 && groups.map(([label, role]) => (
              <div key={role}>
                <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide" style={{ color: T.sub }}>{label}</div>
                {users.filter((u) => u.role === role && !u.noLogin && !u.inactive).map((u) => (
                  <button key={u.id} onClick={() => { onChange(u); setOpen(false); }} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50"
                    style={{ background: u.id === user.id ? T.primarySoft : "transparent" }}>
                    <Avatar name={u.name} size={28} />
                    <div className="min-w-0 leading-tight">
                      <div className="truncate text-sm font-semibold">{u.name}</div>
                      <div className="truncate text-[11px]" style={{ color: T.sub }}>{u.title}</div>
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
