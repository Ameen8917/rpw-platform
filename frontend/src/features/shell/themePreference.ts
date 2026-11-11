import { useSyncExternalStore } from "react";
import { applyTheme, type ThemeName } from "../../theme";

/* The viewer's theme choice. It is a per-device preference, so it lives in localStorage
   (not on the server); "system" follows the operating system and updates live. */
export type ThemePreference = ThemeName | "system";

const KEY = "rpw.theme";
const listeners = new Set<() => void>();
let preference: ThemePreference = read();
let current: ThemeName = "light"; // what is on screen; set by apply()

function read(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch { /* storage blocked: fall back to the system setting */ }
  return "system";
}

function systemQuery() {
  return typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
}

export function resolveTheme(pref: ThemePreference, systemDark = !!systemQuery()?.matches): ThemeName {
  return pref === "system" ? (systemDark ? "dark" : "light") : pref;
}

function apply() {
  current = resolveTheme(preference);
  applyTheme(current);
  listeners.forEach((l) => l());
}

/* Called once from main.tsx before React renders, so the first paint is already themed */
export function initTheme() {
  systemQuery()?.addEventListener?.("change", () => { if (preference === "system") apply(); });
  apply();
}

export function setThemePreference(next: ThemePreference) {
  preference = next;
  try { localStorage.setItem(KEY, next); } catch { /* not remembered, still applied */ }
  apply();
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/* The theme actually showing (a "system" preference resolved), for the top-bar switch */
export function useActiveTheme(): ThemeName {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
