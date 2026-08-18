import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

const appBuildId = new Date().toISOString();

// Fatboy Pedidos — app operativa interna, hermana de `frontend/` (menú
// público). Mismo backend NestJS, mismo puerto de API en dev (8372); solo
// cambia el puerto de este dev server para poder correr ambas apps a la vez.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // La PWA queda instalada en tablets de sucursal por semanas (Sección
    // Veintiocho) — este archivo es lo que main.tsx sondea para detectar
    // que hay un build nuevo y recargar solo, en vez de dejar una versión
    // vieja del tablero corriendo indefinidamente.
    {
      name: 'fatboy-pedidos-app-version',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'app-version.json',
          source: JSON.stringify({ buildId: appBuildId }, null, 2),
        });
      },
    },
  ],
  define: {
    __APP_BUILD_ID__: JSON.stringify(appBuildId),
  },
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
