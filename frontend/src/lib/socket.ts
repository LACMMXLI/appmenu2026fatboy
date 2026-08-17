import { io, type Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';

// Socket.IO needs an absolute origin + path, not the "/api" relative prefix
// used for REST calls. In dev, API_BASE_URL is "/api" (proxied by Vite,
// which also proxies the websocket upgrade — see vite.config.ts `ws: true`),
// so the resolved origin is empty and socket.io-client falls back to
// `window.location.origin`, exactly what we want.
function resolveSocketOrigin(): string {
  const apiOrigin = API_BASE_URL.replace(/\/api$/, '');
  return apiOrigin || window.location.origin;
}

/**
 * Opens an authenticated Socket.IO connection for real-time order events.
 * `token` is the same opaque session token (customer or staff) used for
 * HTTP — the server authenticates it before the connection is even accepted
 * (see backend orders.gateway.ts). Never pass a userId/branchId instead.
 */
export function connectOrdersSocket(token: string): Socket {
  return io(resolveSocketOrigin(), {
    path: '/api/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
  });
}
