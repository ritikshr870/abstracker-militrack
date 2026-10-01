import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Production-ready Vite Configuration for AbsTracker Customer Web App
export default defineConfig({
  base: './',
  plugins: [
    tailwindcss(),
    react()
  ],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/jspdf-autotable') || id.includes('node_modules/xlsx')) {
            return 'export-libs';
          }
          if (id.includes('node_modules/leaflet')) {
            return 'map-libs';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'icons';
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor-core';
          }
        }
      }
    }
  }
});
