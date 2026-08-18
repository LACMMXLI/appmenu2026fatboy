import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

// Fatboy Pedidos — app operativa interna, hermana de `frontend/` (menú
// público). Mismo backend NestJS, mismo puerto de API en dev (8372); solo
// cambia el puerto de este dev server para poder correr ambas apps a la vez.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8372',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
});
