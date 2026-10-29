export const TODAY = new Date("2026-09-06");

export const cx = (...a: unknown[]) => a.filter(Boolean).join(" ");

export const inrFull = (n: number | string) => "₹" + Number(n).toLocaleString("en-IN");

export function inrShort(n: number) {
  if (n >= 1e7) return "₹" + (n / 1e7).toFixed(2).replace(/\.00$/, "") + " Cr";
  if (n >= 1e5) return "₹" + (n / 1e5).toFixed(2).replace(/\.00$/, "") + " L";
  return "₹" + Number(n).toLocaleString("en-IN");
}

export const fmtDate = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};

export const monthKey = (iso: string) => iso.slice(0, 7);

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export const monthLabel = (k: string) => `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`;
