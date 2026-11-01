/** Rows-per-page choices; the server accepts up to 100 */
export const PAGE_SIZES = [10, 20, 50, 100];
export const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];

/** Where one page sits in a list of `total` items. `page` is clamped into range (1-based). */
export interface PageWindow {
  page: number;
  pages: number;
  /** 1-based position of the first and last item shown; 0 when the list is empty */
  from: number;
  to: number;
  offset: number;
}

export function pageWindow(total: number, page: number, pageSize: number): PageWindow {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const p = Math.min(Math.max(1, Math.floor(page) || 1), pages);
  const offset = (p - 1) * pageSize;
  return { page: p, pages, offset, from: total ? offset + 1 : 0, to: Math.min(total, offset + pageSize) };
}

/** Page numbers to show as buttons: the first, the last, and two either side of the current
    one, with "…" for each gap. 1 2 3 4 5 … 20 / 1 … 8 9 10 11 12 … 20 */
export function pageNumbers(page: number, pages: number): (number | "…")[] {
  const keep = new Set([1, pages]);
  for (let p = page - 2; p <= page + 2; p++) if (p >= 1 && p <= pages) keep.add(p);
  const sorted = [...keep].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push(p - sorted[i - 1] === 2 ? p - 1 : "…");
    out.push(p);
  });
  return out;
}
