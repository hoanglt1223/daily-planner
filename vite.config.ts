import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    // Local dev only: forward API calls to `vercel dev` (serverless functions).
    // No effect on the production build, where Vercel handles /api routing.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
