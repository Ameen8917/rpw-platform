import { T } from "../../theme";

/* The wordmark: the "R" mark cropped from public/logo.jpg (its own charcoal tile, so it sits on
   the rail and on the light canvas alike) and the group name in the display serif.
   `dark` is for the sidebar rail; the light version sits on the canvas (splash, mobile bar). */
export function Brand({ dark, sub = "Operations" }: { dark?: boolean; sub?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/logo-mark.png" alt="" width={32} height={32} className="shrink-0 rounded-md"
        style={{ boxShadow: dark ? "0 0 0 1px rgba(255,255,255,.06)" : "0 1px 2px rgba(26,26,28,.18)" }} />
      <div className="leading-none">
        <div className="font-display text-[17px] font-medium tracking-[-0.01em]" style={{ color: dark ? T.railInk : T.ink }}>Ratnapprabbha</div>
        <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em]" style={{ color: dark ? T.railSub : T.sub }}>World · {sub}</div>
      </div>
    </div>
  );
}

export function NavList({ nav, view, go }) {
  return (
    <nav className="space-y-0.5">
      {nav.map((n) => {
        const on = view === n.key;
        return (
          <button key={n.key} onClick={() => go(n.key)} aria-current={on ? "page" : undefined}
            className="relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors duration-150 hover:text-white"
            style={on ? { background: T.railActive, color: T.railInk } : { color: T.railSub }}>
            {on && <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full" style={{ background: T.brand }} />}
            <n.icon size={16} strokeWidth={on ? 2 : 1.75} />{n.label}
          </button>
        );
      })}
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
    <div className="px-3 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,.08)" }}>
      <div className="text-[10px] font-medium uppercase tracking-[0.14em]" style={{ color: T.railSub }}>Signed in as</div>
      <div className="mt-1.5 text-[13px] font-medium" style={{ color: T.railInk }}>{user.title}</div>
      <p className="mt-0.5 text-[12px] leading-snug" style={{ color: T.railSub }}>{line}</p>
    </div>
  );
}
