import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Project Pages live at /BH2026-23-single-cell/; local `npm run dev` stays at /. */
const base = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Libraries in their own files: no chunk over Vite's 500 kB warning, parallel
        // downloads, and the browser keeps them cached when only the app code or data change.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "react";
          if (/node_modules\/(@mui|@emotion)\//.test(id)) return "mui";
          if (/node_modules\/(@nivo|@react-spring|d3-[a-z-]+)\//.test(id)) return "nivo";
          if (/node_modules\/hyparquet/.test(id)) return "parquet";
          return "vendor";
        },
      },
    },
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
  },
});
