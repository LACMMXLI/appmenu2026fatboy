/**
 * Shared CORS origin resolution, reused by the HTTP app (main.ts) and the
 * Socket.IO gateway (orders.gateway.ts) so they always agree on which
 * origins are trusted.
 */
const DEFAULT_DESKTOP_ORIGIN = 'fatboy://app';

export function resolveCorsOrigin(
  value = process.env.CORS_ORIGIN,
  desktopOrigin = process.env.DESKTOP_CORS_ORIGIN ?? DEFAULT_DESKTOP_ORIGIN,
): boolean | string[] {
  const desktopOrigins = desktopOrigin.trim() ? [desktopOrigin.trim()] : [];

  if (!value) {
    return [
      'http://localhost:8371',
      'http://127.0.0.1:8371',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      ...desktopOrigins,
    ];
  }

  if (value.trim() === '*') {
    return true;
  }

  return [...new Set([
    ...value.split(',').map((origin) => origin.trim()).filter(Boolean),
    ...desktopOrigins,
  ])];
}
