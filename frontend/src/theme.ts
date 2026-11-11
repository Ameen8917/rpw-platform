/* Taken from the brand artwork (public/logo.jpg, public/banner.jpg): charcoal and silver,
   a red used sparingly for small marks, and the banner's gold for payment states.
   Status colours are muted so they read as information, not alarms; `bad` stays clearly red.

   Each colour is a CSS variable so the whole app switches theme without re-rendering:
   `PALETTES` holds the values, `applyTheme()` writes them onto <html>, and `T` (what
   components use in inline styles) refers to the variables. Never do colour maths on a
   `T` value (e.g. appending hex alpha); add a token instead. */

const LIGHT = {
  primary: "#232326", primaryDark: "#121214", primarySoft: "#EEEDEA", onPrimary: "#FFFFFF",
  brand: "#C8212F", accent: "#A8742A",
  ink: "#1A1A1C", sub: "#686661", line: "#E4E2DD", lineStrong: "#D1CEC7",
  canvas: "#F4F3F0", surface: "#FFFFFF", hover: "#F8F7F4",
  ok: "#2D6A43", okBg: "#E8F1EA", warn: "#9A5B12", warnBg: "#F7EEDD",
  bad: "#B3261E", badBg: "#F9E9E6", slate: "#5F5D58", slateBg: "#EEECE8",
  /* sidebar, matched to the logo's background */
  rail: "#1C1C1E", railInk: "#EDEDEB", railSub: "#8D8C88", railActive: "#2B2B2E",
  /* translucent layers */
  header: "rgba(244,243,240,.86)", overlay: "rgba(18,18,20,.5)", shadow: "rgba(26,26,28,.06)",
  placeholder: "#A19F99", selection: "#F3D3D6", focusRing: "rgba(35,35,38,.12)",
};

/* Warm charcoal rather than pure black, so it keeps the brand's feel */
const DARK: typeof LIGHT = {
  primary: "#ECEBE8", primaryDark: "#FFFFFF", primarySoft: "#2A2A2C", onPrimary: "#141415",
  brand: "#E0505B", accent: "#D4A256",
  ink: "#ECEBE8", sub: "#A3A19B", line: "#323230", lineStrong: "#4A4946",
  canvas: "#141415", surface: "#1D1D1F", hover: "#252527",
  ok: "#7DC394", okBg: "#1C2E22", warn: "#E0A75A", warnBg: "#33281A",
  bad: "#F07A70", badBg: "#3A1F1C", slate: "#B5B2AB", slateBg: "#2A2927",
  rail: "#0F0F10", railInk: "#EDEDEB", railSub: "#8D8C88", railActive: "#222224",
  header: "rgba(20,20,21,.86)", overlay: "rgba(0,0,0,.6)", shadow: "rgba(0,0,0,.3)",
  placeholder: "#6E6C67", selection: "#5A2A2F", focusRing: "rgba(236,235,232,.18)",
};

export const PALETTES = { light: LIGHT, dark: DARK };
export type ThemeName = keyof typeof PALETTES;
export type ThemeKey = keyof typeof LIGHT;

const cssVar = (k: string) => "--c-" + k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());

export const T = Object.fromEntries(
  Object.keys(LIGHT).map((k) => [k, `var(${cssVar(k)})`]),
) as Record<ThemeKey, string>;

export function applyTheme(name: ThemeName, root: HTMLElement = document.documentElement) {
  const p = PALETTES[name];
  for (const k of Object.keys(p)) root.style.setProperty(cssVar(k), p[k as ThemeKey]);
  root.dataset.theme = name;
  root.style.colorScheme = name; // native controls, scrollbars, date pickers
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", p.rail);
}
