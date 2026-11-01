import colors from "tailwindcss/colors";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      /* The palette is warm; map the few `slate` utilities (hover rows) onto warm greys */
      colors: { slate: colors.stone },
      fontFamily: {
        sans: ['"IBM Plex Sans"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
        display: ['"Fraunces Variable"', "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
