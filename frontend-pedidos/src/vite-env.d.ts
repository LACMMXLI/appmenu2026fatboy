/// <reference types="vite/client" />

import type { FatboyDesktopApi } from './desktop/desktop-types';

declare global {
  const __APP_BUILD_ID__: string;
  const __APP_VERSION__: string;

  interface Window {
    fatboyDesktop?: FatboyDesktopApi;
  }
}

export {};
