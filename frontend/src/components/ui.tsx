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
}
export function Btn({ kind = "primary", icon: Icon, children, onClick, disabled, full, size = "md" }: BtnProps) {
  const pad = size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-sm";
  const styles = {
    primary: { background: T.primary, color: "#fff", border: "1px solid " + T.primary },
    secondary: { background: "#fff", color: T.primary, border: "1px solid " + T.line },
    ghost: { background: "transparent", color: T.sub, border: "1px solid transparent" },
    danger: { background: "#fff", color: T.bad, border: "1px solid " + T.badBg },
  }[kind];
  return (
    <button onClick={onClick} disabled={disabled}
      className={cx("inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition active:scale-[0.98]", pad, full && "w-full", disabled && "opacity-40 cursor-not-allowed")}
      style={styles}>{Icon && <Icon size={16} />}{children}</button>
  );
}

export function Card({ children, className, pad = true }: { children?: ReactNode; className?: string; pad?: boolean }) {
  return <div className={cx("rounded-xl", pad && "p-4", className)} style={{ background: T.surface, border: "1px solid " + T.line }}>{children}</div>;
}

export function Field({ label, children }: { label: ReactNode; children?: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold" style={{ color: T.sub }}>{label}</span>{children}</label>;
}

export const inputCls = "w-full rounded-lg px-3 py-2.5 text-sm outline-none";

export const inputStyle: CSSProperties = { border: "1px solid " + T.line, color: T.ink, background: "#fff" };

export function Modal({ title, onClose, children, footer }: { title: ReactNode; onClose: () => void; children?: ReactNode; footer?: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
      style={{ background: "rgba(16,32,46,.45)" }} onClick={onClose}>
      {/* Column layout with a bounded height: header and footer stay put, the middle scrolls */}
      <div className="flex w-full max-w-lg flex-col rounded-t-2xl md:rounded-2xl"
        style={{ background: "#fff", maxHeight: "88vh" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid " + T.line }}>
          <h3 className="text-base font-bold">{title}</h3>
          <button onClick={onClose} style={{ color: T.sub }}><X size={20} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4"
          style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain", touchAction: "pan-y" }}>
          {children}
        </div>
        {footer && <div className="flex shrink-0 gap-2 px-5 py-4" style={{ borderTop: "1px solid " + T.line }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Avatar({ name, size = 34 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return <div className="flex shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ width: size, height: size, background: T.primary, fontSize: size * 0.38 }}>{initials}</div>;
}

export function PageHead({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return <div><h1 className="text-xl font-bold">{title}</h1>{sub && <p className="text-sm" style={{ color: T.sub }}>{sub}</p>}</div>;
}

export function SectionTitle({ icon: Icon, children }: { icon: Icon; children?: ReactNode }) {
  return <div className="flex items-center gap-2 text-sm font-bold"><Icon size={16} style={{ color: T.primary }} />{children}</div>;
}

export function Stat({ label, value, icon: Icon, accent, tone }: { label: ReactNode; value: ReactNode; icon: Icon; accent?: boolean; tone?: "warn" | "bad" }) {
  const c = tone === "warn" ? T.warn : tone === "bad" ? T.bad : accent ? T.primary : T.ink;
  return (
    <Card>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold" style={{ color: T.sub }}>{label}</span><Icon size={16} style={{ color: T.sub }} />
      </div>
      <div className="mt-1 text-xl font-bold" style={{ color: c }}>{value}</div>
    </Card>
  );
}

export function MiniStat({ label, value }: { label: ReactNode; value: ReactNode }) {
  return <div className="rounded-lg px-3 py-2" style={{ background: T.canvas }}>
    <div className="text-[11px]" style={{ color: T.sub }}>{label}</div><div className="text-base font-bold">{value}</div>
  </div>;
}

export function Row({ icon: Icon, k, v, mono }: { icon: Icon; k: ReactNode; v: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={15} className="mt-0.5 shrink-0" style={{ color: T.sub }} />
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold" style={{ color: T.sub }}>{k}</dt>
        <dd className={cx("text-sm", mono && "font-mono")}>{v}</dd>
      </div>
    </div>
  );
}

export function Empty({ msg }: { msg: ReactNode }) { return <div className="py-8 text-center text-sm" style={{ color: T.sub }}>{msg}</div>; }

export function Th({ children, right }: { children?: ReactNode; right?: boolean }) { return <th className={cx("px-4 py-2.5 text-[11px] font-semibold", right ? "text-right" : "text-left")}>{children}</th>; }

export function Td({ children, right, sub }: { children?: ReactNode; right?: boolean; sub?: boolean }) { return <td className={cx("px-4 py-3 align-middle", right && "text-right")} style={sub ? { color: T.sub } : undefined}>{children}</td>; }
