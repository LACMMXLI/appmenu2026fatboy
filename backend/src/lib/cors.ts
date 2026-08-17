/**
 * Shared CORS origin resolution, reused by the HTTP app (main.ts) and the
 * Socket.IO gateway (orders.gateway.ts) so they always agree on which
 * origins are trusted.
 */
export function resolveCorsOrigin(value = process.env.CORS_ORIGIN): boolean | string[] {
  if (!value) {
    return [
      'http://localhost:8371',
      'http://127.0.0.1:8371',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ];
  }

  if (value.trim() === '*') {
    return true;
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
