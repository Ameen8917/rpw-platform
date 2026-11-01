import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZES, pageNumbers, pageWindow } from "../domain/pagination";
import { cx } from "../lib/format";
import { T } from "../theme";

/* "Showing 11–20 of 43", a rows-per-page choice, Previous / Next and page numbers. Shown whenever
   there is something to show, even on a single page, so the controls are always in the same place.
   `page` may be out of range; it is shown clamped. */
export function Pagination({ total, page, pageSize, onPage, onPageSize, noun = "items" }: {
  total: number;
  page: number;
  pageSize: number;
  onPage: (page: number) => void;
  /** Called with the new size; the caller goes back to page 1 */
  onPageSize: (size: number) => void;
  noun?: string;
}) {
  if (total === 0) return null;
  const w = pageWindow(total, page, pageSize);
  const btn = "flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[13px] font-medium transition-colors duration-150";
  return (
    <nav aria-label="Pages" className="flex flex-col items-center justify-between gap-2 px-1 sm:flex-row">
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[12px]" style={{ color: T.sub }}>
        <span>Showing <b style={{ color: T.ink }}>{w.from}–{w.to}</b> of {total} {noun}</span>
        <label className="flex items-center gap-1.5">
          Rows per page
          <select value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))}
            className="rounded-md px-1.5 py-1 text-[12px]" style={{ border: "1px solid " + T.line, color: T.ink, background: T.surface }}>
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-1">
        <button className={cx(btn, w.page === 1 ? "cursor-not-allowed opacity-40" : "hover:bg-black/[0.05]")}
          disabled={w.page === 1} onClick={() => onPage(w.page - 1)} aria-label="Previous page" style={{ color: T.sub }}>
          <ChevronLeft size={16} />
        </button>
        {pageNumbers(w.page, w.pages).map((p, i) => p === "…"
          ? <span key={`gap${i}`} className="px-1 text-[13px]" style={{ color: T.sub }}>…</span>
          : (
            <button key={p} onClick={() => onPage(p)} aria-current={p === w.page ? "page" : undefined}
              className={cx(btn, p !== w.page && "hover:bg-black/[0.05]")}
              style={p === w.page ? { background: T.primary, color: "#fff" } : { color: T.ink }}>
              {p}
            </button>
          ))}
        <button className={cx(btn, w.page === w.pages ? "cursor-not-allowed opacity-40" : "hover:bg-black/[0.05]")}
          disabled={w.page === w.pages} onClick={() => onPage(w.page + 1)} aria-label="Next page" style={{ color: T.sub }}>
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
