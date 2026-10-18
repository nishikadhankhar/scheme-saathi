import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /api goes to the FastAPI backend (backend/run.sh, port 8000).
// For a deployed build, set VITE_API_BASE to the backend's URL instead.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: { '/api': { target: process.env.VITE_PROXY_TARGET || 'http://localhost:8000', changeOrigin: true } },
  },
});
