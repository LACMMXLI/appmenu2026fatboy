import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// PWA (Sección Veintisiete del plan): el service worker existe solo para
// que la app sea instalable y abra rápido — nunca cachea /api (ver
// public/sw.js). Una tablet de sucursal puede quedarse con esta pestaña
// abierta por días (Sección Veintiocho), así que además vigilamos
// app-version.json para recargar sola cuando hay un build nuevo, en vez de
// dejar operando una versión vieja del tablero indefinidamente.
const APP_UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const APP_UPDATE_RELOAD_KEY = 'fatboy-pedidos-reloading-for-update';

function reloadForAppUpdate() {
  if (sessionStorage.getItem(APP_UPDATE_RELOAD_KEY) === __APP_BUILD_ID__) return;
  sessionStorage.setItem(APP_UPDATE_RELOAD_KEY, __APP_BUILD_ID__);
  window.location.reload();
}

async function fetchLatestBuildId(): Promise<string | null> {
  const response = await fetch(`/app-version.json?updatedAt=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) return null;
  const payload = await response.json();
  return typeof payload.buildId === 'string' ? payload.buildId : null;
}

async function checkForAppVersionUpdate() {
  try {
    const latestBuildId = await fetchLatestBuildId();
    if (latestBuildId && latestBuildId !== __APP_BUILD_ID__) reloadForAppUpdate();
  } catch (error) {
    console.error('Error checking app update:', error);
  }
}

function activateWaitingServiceWorker(registration: ServiceWorkerRegistration) {
  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.addEventListener('controllerchange', reloadForAppUpdate);

    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        activateWaitingServiceWorker(registration);

        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          if (!installingWorker) return;
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              activateWaitingServiceWorker(registration);
            }
          });
        });

        registration.update().catch((error) => console.error('Error updating service worker:', error));
      })
      .catch((error) => console.error('Error registering service worker:', error));

    checkForAppVersionUpdate();
    window.setInterval(checkForAppVersionUpdate, APP_UPDATE_CHECK_INTERVAL_MS);
  });
}
