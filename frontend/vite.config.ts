import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: false },
  // Pre-bundle heavy dependencies at startup. Otherwise Vite discovers them the
  // first time a lazy page loads, re-optimizes and force-reloads, and in-flight
  // page chunks fail with "Outdated Optimize Dep".
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react-router-dom', 'recharts', '@xyflow/react', 'lucide-react', 'clsx'],
  },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
          flow: ['@xyflow/react'],
        },
      },
    },
  },
});
