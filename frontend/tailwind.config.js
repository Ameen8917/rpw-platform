import colors from "tailwindcss/colors";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      /* The palette is warm; map the few `slate` utilities (hover rows) onto warm greys */
      colors: {
        slate: colors.stone,
        /* Theme-aware tokens (CSS variables set by applyTheme in src/theme.ts) */
        hover: "var(--c-hover)",
        line: "var(--c-line)",
        "line-strong": "var(--c-line-strong)",
        "bad-soft": "var(--c-bad-bg)",
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        display: ['"Fraunces Variable"', "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
