import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { fileURLToPath } from 'node:url';
import { createPedidosRendererConfig } from './vite.config';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const rendererConfig = createPedidosRendererConfig('./');

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: fileURLToPath(new URL('./electron/main.ts', import.meta.url)),
        },
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: fileURLToPath(new URL('./electron/preload.ts', import.meta.url)),
        },
        output: {
          format: 'cjs',
          entryFileNames: 'index.cjs',
        },
      },
    },
  },
  renderer: {
    ...rendererConfig,
    root: projectRoot,
    build: {
      ...rendererConfig.build,
      rollupOptions: {
        ...rendererConfig.build?.rollupOptions,
        input: fileURLToPath(new URL('./index.html', import.meta.url)),
      },
    },
  },
});
