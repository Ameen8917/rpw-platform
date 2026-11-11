import { Moon, Sun } from "lucide-react";
import { T } from "../../theme";
import { setThemePreference, useActiveTheme } from "./themePreference";

/* Top-bar light/dark switch: a sliding knob carrying the current mode's icon.
   Until someone flips it, the app follows the device setting; a flip is remembered on this device. */
export function ThemeSwitcher() {
  const dark = useActiveTheme() === "dark";
  const next = dark ? "light" : "dark";
  return (
    <button type="button" role="switch" aria-checked={dark} aria-label="Dark mode"
      title={`Switch to ${next} mode`} onClick={() => setThemePreference(next)}
      className="relative flex h-8 w-[60px] shrink-0 items-center justify-between rounded-full px-2 transition-colors duration-200"
      style={{ background: T.primarySoft, border: "1px solid " + T.line }}>
      {/* Faint icons on the track show where each mode sits */}
      <Sun size={14} strokeWidth={2} style={{ color: T.sub, opacity: dark ? 0.7 : 0 }} aria-hidden="true" />
      <Moon size={14} strokeWidth={2} style={{ color: T.sub, opacity: dark ? 0 : 0.7 }} aria-hidden="true" />
      <span aria-hidden="true"
        className="absolute top-[3px] flex h-6 w-6 items-center justify-center rounded-full transition-[left] duration-200 ease-out"
        style={{ left: dark ? 31 : 3, background: T.surface, boxShadow: "0 1px 3px " + T.shadow + ", 0 0 0 1px " + T.line }}>
        {dark
          ? <Moon size={13} strokeWidth={2.2} style={{ color: T.accent }} />
          : <Sun size={13} strokeWidth={2.2} style={{ color: T.accent }} />}
      </span>
    </button>
  );
}
