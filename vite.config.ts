import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://v2.tauri.app/start/create-project/#using-vite
export default defineConfig({
  plugins: [react()],
  base: './',

  // Prevent Vite from clearing the terminal when Tauri is running alongside
  clearScreen: false,

  server: {
    // Tauri's devUrl must match this port exactly
    port: 5173,
    strictPort: true,
    watch: {
      // Don't hot-reload on Rust source changes — Tauri handles those
      ignored: ['**/src-tauri/**'],
    },
  },
});
