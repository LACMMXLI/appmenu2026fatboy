import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

const appBuildId = new Date().toISOString();

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'fatboy-app-version',
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
      "@": fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8372',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
