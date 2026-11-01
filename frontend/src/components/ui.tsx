import type { CSSProperties, MouseEventHandler, ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import { cx } from "../lib/format";
import { T } from "../theme";

export type Icon = LucideIcon;

export interface BtnProps {
  kind?: "primary" | "secondary" | "ghost" | "danger";
  icon?: Icon;
  children?: ReactNode;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  full?: boolean;
  size?: "sm" | "md";
  type?: "button" | "submit";
}
export function Btn({ kind = "primary", icon: Icon, children, onClick, disabled, full, size = "md", type = "button" }: BtnProps) {
  const pad = size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-4 text-sm";
  const styles = {
    primary: { background: T.primary, color: "#fff", border: "1px solid " + T.primary },
    secondary: { background: T.surface, color: T.ink, border: "1px solid " + T.line },
    ghost: { background: "transparent", color: T.sub, border: "1px solid transparent" },
    danger: { background: T.surface, color: T.bad, border: "1px solid " + T.line },
  }[kind];
  const hover = {
    primary: "hover:brightness-[1.18]",
    secondary: "hover:bg-stone-50 hover:border-stone-300",
    ghost: "hover:bg-black/[0.04]",
    danger: "hover:bg-red-50",
  }[kind];
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={cx("inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium transition-[filter,background-color,border-color] duration-150 active:translate-y-px",
        pad, full && "w-full", disabled ? "cursor-not-allowed opacity-40" : hover)}
      style={{ ...styles, boxShadow: kind === "primary" || kind === "secondary" ? "0 1px 1px rgba(26,26,28,.06)" : undefined }}>
      {Icon && <Icon size={size === "sm" ? 14 : 16} strokeWidth={2} />}{children}
    </button>
  );
}

export function Card({ children, className, pad = true }: { children?: ReactNode; className?: string; pad?: boolean }) {
  return <div className={cx("rounded-lg", pad && "p-4 md:p-5", className)}
    style={{ background: T.surface, border: "1px solid " + T.line, boxShadow: "0 1px 2px rgba(26,26,28,.04)" }}>{children}</div>;
}

export function Field({ label, children }: { label: ReactNode; children?: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[12px] font-medium" style={{ color: T.sub }}>{label}</span>{children}</label>;
}

export const inputCls = "w-full rounded-md px-3 py-2.5 text-sm outline-none transition-[border-color,box-shadow] duration-150";

export const inputStyle: CSSProperties = { border: "1px solid " + T.line, color: T.ink, background: T.surface };

export function Modal({ title, onClose, children, footer }: { title: ReactNode; onClose: () => void; children?: ReactNode; footer?: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6"
      style={{ background: "rgba(18,18,20,.5)", backdropFilter: "blur(2px)" }} onClick={onClose}>
      {/* Column layout with a bounded height: header and footer stay put, the middle scrolls */}
      <div className="flex w-full max-w-lg flex-col rounded-t-xl md:rounded-xl"
        style={{ background: T.surface, maxHeight: "88vh", boxShadow: "0 24px 48px -12px rgba(18,18,20,.35)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between gap-4 px-5 py-4" style={{ borderBottom: "1px solid " + T.line }}>
          <h3 className="font-display text-lg font-medium leading-tight">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="-mr-1 rounded-md p-1 hover:bg-black/[0.05]" style={{ color: T.sub }}><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", touchAction: "pan-y" }}>
          {children}
        </div>
        {footer && <div className="flex shrink-0 gap-2 px-5 py-3.5" style={{ borderTop: "1px solid " + T.line, background: T.canvas, borderRadius: "0 0 12px 12px" }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return <div className="flex shrink-0 items-center justify-center rounded-full font-semibold"
    style={{ width: size, height: size, background: T.primarySoft, color: T.primary, fontSize: size * 0.36, letterSpacing: "0.02em" }}>{initials}</div>;
}

export function PageHead({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0">
      <h1 className="font-display text-[26px] font-medium leading-tight md:text-[30px]">{title}</h1>
      {sub && <p className="mt-1 text-[13px]" style={{ color: T.sub }}>{sub}</p>}
    </div>
  );
}

/* `icon` is accepted for existing call sites but not drawn; headings read cleaner without it */
export function SectionTitle({ children }: { icon?: Icon; children?: ReactNode }) {
  return <div className="text-[15px] font-semibold leading-snug" style={{ color: T.ink }}>{children}</div>;
}

export function Stat({ label, value, accent, tone }: { label: ReactNode; value: ReactNode; icon?: Icon; accent?: boolean; tone?: "warn" | "bad" }) {
  const c = tone === "warn" ? T.warn : tone === "bad" ? T.bad : accent ? T.primary : T.ink;
  return (
    <Card>
      <div className="text-[12px] font-medium" style={{ color: T.sub }}>{label}</div>
      <div className="mt-2 font-display text-[30px] font-normal leading-none" style={{ color: c }}>{value}</div>
    </Card>
  );
}

export function MiniStat({ label, value }: { label: ReactNode; value: ReactNode }) {
  return <div className="rounded-md px-3 py-2.5" style={{ background: T.canvas }}>
    <div className="text-[11px] font-medium" style={{ color: T.sub }}>{label}</div><div className="mt-0.5 text-base font-semibold">{value}</div>
  </div>;
}

export function Row({ icon: Icon, k, v, mono }: { icon: Icon; k: ReactNode; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon size={14} strokeWidth={1.75} className="mt-[3px] shrink-0" style={{ color: T.sub }} />
      <div className="min-w-0">
        <dt className="text-[11px] font-medium" style={{ color: T.sub }}>{k}</dt>
        <dd className={cx("text-sm", mono && "font-mono text-[13px]")}>{v}</dd>
      </div>
    </div>
  );
}

export function Empty({ msg }: { msg: ReactNode }) { return <div className="py-10 text-center text-sm" style={{ color: T.sub }}>{msg}</div>; }

export function Th({ children, right }: { children?: ReactNode; right?: boolean }) { return <th className={cx("px-4 py-2.5 text-[10.5px] font-semibold uppercase", right ? "text-right" : "text-left")}>{children}</th>; }

export function Td({ children, right, sub }: { children?: ReactNode; right?: boolean; sub?: boolean }) { return <td className={cx("px-4 py-3 align-middle", right && "text-right")} style={sub ? { color: T.sub } : undefined}>{children}</td>; }
