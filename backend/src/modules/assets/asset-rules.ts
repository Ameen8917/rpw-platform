import type { AuthContext } from "../auth/auth.service.js";

/* Pure asset rules, ported from frontend/src/domain/assets.ts. Kept in step with the frontend
   until the two share a package. */

export const CATEGORY_META = {
  "IT Equipment": { code: "IT", life: 3 },
  "IT – Servers & Network": { code: "SRV", life: 6 },
  "Diagnostic Equipment": { code: "DIA", life: 15 },
  "Workshop Equipment": { code: "WRK", life: 15 },
  "Machinery & Power": { code: "MCH", life: 15 },
  "Furniture & Fixtures": { code: "FUR", life: 10 },
  "Office Equipment": { code: "OFF", life: 5 },
  "Internal Vehicles": { code: "VEH", life: 8 },
} as const;
export type AssetCategory = keyof typeof CATEGORY_META;
export const CATEGORIES = Object.keys(CATEGORY_META) as [AssetCategory, ...AssetCategory[]];

export const ASSET_STATUSES = ["in_use", "in_storage", "under_repair", "disposed"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
export const ASSET_SOURCES = ["existing", "procured"] as const;
export type AssetSource = (typeof ASSET_SOURCES)[number];

/** Schedule II residual value assumption, % of cost */
export const RESIDUAL_PCT = 5;

/** ₹. A separately bought item at or above this is an asset in its own right, not an accessory.
    Matches LIMITS.capitalisation in the frontend; a group setting once the settings table exists. */
export const CAPITALISATION_FLOOR = 5000;

/** Calendar date in India ("2026-10-29"); the group operates in IST */
export function todayIST(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

/** Financial year label for a "YYYY-MM-DD" date: April–March, e.g. "26-27" */
export function fyOf(isoDate: string) {
  const [y, m] = isoDate.split("-").map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

/** "RPW/JNS/IT/26-27/" — the sequence number is appended per prefix */
export function assetCodePrefix(dealershipShort: string, category: AssetCategory, isoDate: string) {
  return `RPW/${dealershipShort}/${CATEGORY_META[category].code}/${fyOf(isoDate)}/`;
}

export function assetCode(prefix: string, n: number) {
  return prefix + String(n).padStart(4, "0");
}

/** "RPW/JNS/IT/26-27/0007-A1" for the first accessory */
export function accessoryCode(assetCode: string, position: number) {
  return `${assetCode}-A${position}`;
}

const DAY_MS = 86_400_000;
const utcDays = (isoDate: string) => {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
};

/* Companies Act 2013 Schedule II, written-down value, 5% residual; as at `asOf` ("YYYY-MM-DD").
   null when there is nothing to depreciate. */
export function depreciation(a: { category: AssetCategory; purchaseDate: string | null; cost: number }, asOf: string) {
  const life = CATEGORY_META[a.category]?.life;
  if (!life || !a.purchaseDate || !a.cost) return null;
  const years = Math.max(0, (utcDays(asOf) - utcDays(a.purchaseDate)) / 365.25);
  const residual = a.cost * (RESIDUAL_PCT / 100);
  const rate = 1 - Math.pow(residual / a.cost, 1 / life);
  const elapsed = Math.min(years, life);
  const nbv = Math.max(residual, a.cost * Math.pow(1 - rate, elapsed));
  return {
    life, rate: rate * 100, years, residual, nbv,
    accumulated: a.cost - nbv,
    fullyDepreciated: years >= life,
  };
}

/* Which assets a user may see: Director and corporate functional heads all of them, everyone
   else the dealerships they belong to. (The prototype took a non-BH user's first dealership;
   only Business Heads belong to more than one, so the result is the same.) */
export type AssetScope = { all: true } | { all: false; dealershipIds: string[] };
export function assetScope({ user, permissions }: AuthContext): AssetScope {
  if (permissions.isDirector || permissions.isFnHead) return { all: true };
  return { all: false, dealershipIds: user.dealershipIds };
}

export function inScope(scope: AssetScope, dealershipId: string) {
  return scope.all || scope.dealershipIds.includes(dealershipId);
}

/** ₹ amount as the prototype shows it in audit details: "₹62,000" */
export const inrFull = (n: number) => "₹" + n.toLocaleString("en-IN");
