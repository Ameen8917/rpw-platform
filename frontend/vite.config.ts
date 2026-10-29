import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    /* The Express API will run on 4000; /api calls are proxied so the browser never needs its URL */
    proxy: { "/api": "http://localhost:4000" },
  },
});
