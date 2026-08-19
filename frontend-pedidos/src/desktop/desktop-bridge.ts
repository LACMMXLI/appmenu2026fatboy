import type { FatboyDesktopApi } from './desktop-types';

export function getDesktopApi(): FatboyDesktopApi | null {
  return window.fatboyDesktop ?? null;
}

export function isDesktopApp(): boolean {
  return Boolean(window.fatboyDesktop?.isDesktop);
}
