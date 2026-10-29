import { defineConfig } from "vitest/config";

/* Kept apart from vite.config.ts: vitest 2.x bundles Vite 5 types, which clash with the Vite 6 React plugin */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
