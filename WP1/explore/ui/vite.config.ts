import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Project Pages live at /BH2026-23-single-cell/; local `npm run dev` stays at /. */
const base = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    host: "0.0.0.0",
  },
});
