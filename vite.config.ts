import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Le front est un build statique pur (→ dist/). Les appels Mews passent par les
// Pages Functions (functions/api/mews/*), servies par wrangler sur la même origine.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  server: {
    port: 5173,
    strictPort: true,
    // En dev : Vite sert le front (HMR) et proxie /api/* vers l'instance
    // `wrangler pages dev` (Functions) lancée en parallèle sur le port 8788.
    // En prod (Cloudflare Pages) front + Functions sont déjà sur la même origine.
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8788",
        changeOrigin: true,
      },
    },
  },
});
