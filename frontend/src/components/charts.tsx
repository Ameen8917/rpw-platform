import { useState, type ReactNode } from "react";
import { niceTicks } from "../domain/dashboard";
import { cx } from "../lib/format";
import { T } from "../theme";

/* Small hand-built charts in HTML/CSS: they follow the theme through T's CSS variables,
   resize with their container, and need no chart library.
   Conventions: one hue per chart (T.chart), thin bars with a 4px rounded data end,
   hairline grid, text in text colours (never the bar colour), values on hover and focus. */

function Tip({ children, align = "center" }: { children: ReactNode; align?: "left" | "center" | "right" }) {
  return (
    <div role="tooltip" className={cx("pointer-events-none absolute bottom-full z-20 mb-2 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] shadow-lg",
      align === "center" && "left-1/2 -translate-x-1/2", align === "left" && "left-0", align === "right" && "right-0")}
      style={{ background: T.surface, border: "1px solid " + T.line, color: T.ink }}>
      {children}
    </div>
  );
}

export interface ColumnDatum { key: string; label: string; title: string; value: number; detail?: string }

/** Single-series columns along a baseline. Clicking a column selects it (click again to clear). */
export function ColumnChart({ data, selected, onSelect, format, height = 190, label, tickCount = 4 }: {
  data: ColumnDatum[]; selected: string | null; onSelect: (key: string | null) => void;
  format: (v: number) => string; height?: number; label: string; tickCount?: number;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(0, ...data.map((d) => d.value));
  const ticks = niceTicks(max, tickCount);
  const top = ticks[ticks.length - 1] || 1;
  /* Label one value on its cap: the selected column, or else the tallest */
  const labelled = selected ?? (max > 0 ? data.find((d) => d.value === max)?.key : null);

  return (
    <div className="flex gap-2" role="group" aria-label={label}>
      {/* y axis */}
      <div className="relative shrink-0 text-right text-[10.5px]" style={{ height, width: 44, color: T.sub }}>
        {ticks.map((t) => (
          <div key={t} className="absolute right-0 -translate-y-1/2 leading-none" style={{ bottom: `${(t / top) * 100}%` }}>
            {t === 0 ? "0" : format(t)}
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative" style={{ height }}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0" style={{ bottom: `${(t / top) * 100}%`, borderTop: "1px solid " + (t === 0 ? T.lineStrong : T.line) }} />
          ))}
          <div className="absolute inset-0 flex items-end">
            {data.map((d, i) => {
              const h = (d.value / top) * 100;
              const on = selected === d.key;
              const dim = selected !== null && !on;
              const showTip = hover === d.key;
              return (
                <button key={d.key} type="button" aria-pressed={on}
                  aria-label={`${d.title}: ${format(d.value)}${d.detail ? ", " + d.detail : ""}`}
                  onClick={() => onSelect(on ? null : d.key)}
                  onPointerEnter={() => setHover(d.key)} onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(d.key)} onBlur={() => setHover(null)}
                  className="group relative flex h-full min-w-0 flex-1 items-end justify-center rounded-md outline-offset-0"
                  style={{ background: showTip ? T.hover : "transparent" }}>
                  <span className="relative block w-[62%] max-w-[28px] rounded-t-[4px] transition-[height,background-color] duration-300 ease-out"
                    style={{ height: d.value > 0 ? `max(${h}%, 3px)` : 0, background: dim ? T.chartDim : T.chart }}>
                    {labelled === d.key && d.value > 0 && !showTip && (
                      <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold" style={{ color: T.ink }}>
                        {format(d.value)}
                      </span>
                    )}
                  </span>
                  {showTip && (
                    <div className="absolute inset-x-0" style={{ bottom: `${Math.min(h, 100)}%` }}>
                      <Tip align={i === 0 ? "left" : i === data.length - 1 ? "right" : "center"}>
                        <div className="text-[13px] font-semibold">{format(d.value)}</div>
                        <div style={{ color: T.sub }}>{d.title}{d.detail ? ` · ${d.detail}` : ""}</div>
                      </Tip>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        {/* x axis */}
        <div className="mt-1.5 flex">
          {data.map((d) => (
            <div key={d.key} className="min-w-0 flex-1 truncate text-center text-[11px]"
              style={{ color: selected === d.key ? T.ink : T.sub, fontWeight: selected === d.key ? 600 : 400 }}>
              {d.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export interface BarPart { key: string; value: number; color: string }
/** `parts` splits the bar (2px gap between parts); `note` is a quiet line after the label */
export interface BarRow { key: string; label: string; value: number; hint?: string; note?: string; parts?: BarPart[] }

/** Ranked horizontal bars with the value at each bar's tip */
export function BarList({ rows, format, onPick, empty = "Nothing in this period." }: {
  rows: BarRow[]; format: (v: number) => string; onPick?: (key: string) => void; empty?: string;
}) {
  const max = Math.max(0, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-6 text-center text-[13px]" style={{ color: T.sub }}>{empty}</p>;
  return (
    <ul className="space-y-1">
      {rows.map((r) => {
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate" title={r.hint || r.label}>
                {r.label}{r.note && <span className="ml-1.5 text-[11.5px]" style={{ color: T.sub }}>{r.note}</span>}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{format(r.value)}</span>
            </div>
            <div className="mt-1 flex h-2 w-full gap-[2px] overflow-hidden rounded-full" style={{ background: T.canvas }}>
              {(r.parts || [{ key: "all", value: r.value, color: T.chart }]).filter((p) => p.value > 0).map((p) => (
                <div key={p.key} className="h-full transition-[width] duration-500 ease-out first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${max ? Math.max((p.value / max) * 100, 1.5) : 0}%`, background: p.color }} />
              ))}
            </div>
          </>
        );
        return (
          <li key={r.key}>
            {onPick && r.key !== "__other"
              ? <button type="button" onClick={() => onPick(r.key)} className="w-full rounded-md px-2 py-1.5 text-left hover:bg-hover">{body}</button>
              : <div className="px-2 py-1.5">{body}</div>}
          </li>
        );
      })}
    </ul>
  );
}

export interface Segment { key: string; label: string; value: number; color: string }

/** One bar split into parts of a whole, with a legend that doubles as the table */
export function StackedBar({ segments, onPick, unit = "" }: { segments: Segment[]; onPick?: (key: string) => void; unit?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  const shown = segments.filter((s) => s.value > 0);
  return (
    <div>
      <div className="flex h-3.5 w-full gap-[2px] overflow-visible">
        {total === 0 && <div className="h-full w-full rounded-full" style={{ background: T.canvas }} />}
        {shown.map((s, i) => (
          <div key={s.key} className="relative h-full transition-opacity"
            onPointerEnter={() => setHover(s.key)} onPointerLeave={() => setHover(null)}
            style={{
              width: `${(s.value / total) * 100}%`, minWidth: 6, background: s.color,
              opacity: hover && hover !== s.key ? 0.35 : 1,
              borderRadius: `${i === 0 ? 999 : 2}px ${i === shown.length - 1 ? 999 : 2}px ${i === shown.length - 1 ? 999 : 2}px ${i === 0 ? 999 : 2}px`,
            }}>
            {hover === s.key && (
              <Tip align={i === 0 ? "left" : i === shown.length - 1 ? "right" : "center"}>
                <div className="text-[13px] font-semibold">{s.value}{unit} · {pct(s.value)}%</div>
                <div style={{ color: T.sub }}>{s.label}</div>
              </Tip>
            )}
          </div>
        ))}
      </div>
      <ul className="mt-4 grid grid-cols-1 gap-y-0.5">
        {segments.map((s) => {
          const row = (
            <>
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: s.color }} />
              <span className="min-w-0 flex-1 truncate text-[13px]" style={{ color: T.sub }}>{s.label}</span>
              <span className="text-[13px] font-semibold tabular-nums">{s.value}</span>
              <span className="w-9 text-right text-[11px] tabular-nums" style={{ color: T.sub }}>{pct(s.value)}%</span>
            </>
          );
          const common = {
            onPointerEnter: () => setHover(s.key), onPointerLeave: () => setHover(null),
            className: "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left",
          };
          return (
            <li key={s.key}>
              {onPick
                ? <button type="button" {...common} className={common.className + " hover:bg-hover"} onClick={() => onPick(s.key)}
                    onFocus={() => setHover(s.key)} onBlur={() => setHover(null)}>{row}</button>
                : <div {...common}>{row}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Pill buttons for a single choice (period, measure) */
export function Segmented<V extends string | number>({ options, value, onChange, label }: {
  options: { value: V; label: string }[]; value: V; onChange: (v: V) => void; label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md p-0.5" style={{ background: T.canvas, border: "1px solid " + T.line }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={String(o.value)} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)}
            className="rounded-[5px] px-2.5 py-1 text-[12px] font-medium transition-colors"
            style={on ? { background: T.surface, color: T.ink, boxShadow: "0 1px 2px " + T.shadow } : { color: T.sub }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
