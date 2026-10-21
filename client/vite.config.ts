import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  // e2e slots set this so concurrent Vite servers don't race on one dependency cache (EPERM on Windows)
  cacheDir: process.env.E2E_VITE_CACHE_DIR ?? "node_modules/.vite",
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "app"),
    },
  },
  optimizeDeps: {
    include: ["@apollo/client", "graphql"],
    esbuildOptions: {
      mainFields: ["module", "main"],
    },
  },
  plugins: [
    tailwindcss(),
    tsconfigPaths(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Tracker',
        short_name: 'Tracker',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#111827',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  build: {
    target: 'es2022',
  },
});

