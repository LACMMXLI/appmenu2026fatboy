import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { CartProvider } from './context/CartContext.tsx';
import { UserProvider } from './context/UserContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UserProvider>
      <CartProvider>
        <App />
      </CartProvider>
    </UserProvider>
  </StrictMode>,
);

const PWA_EXCLUDED_PATHS = ['/admin-catalog', '/branch-orders'];
const APP_UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const APP_UPDATE_RELOAD_KEY = 'fatboy-pwa-reloading-for-update';

function isPwaExcludedPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return PWA_EXCLUDED_PATHS.some((path) => normalized === path || normalized.startsWith(`${path}/`));
}

function reloadForAppUpdate() {
  if (sessionStorage.getItem(APP_UPDATE_RELOAD_KEY) === __APP_BUILD_ID__) return;
  sessionStorage.setItem(APP_UPDATE_RELOAD_KEY, __APP_BUILD_ID__);

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    const messageChannel = new MessageChannel();
    messageChannel.port1.onmessage = (event) => {
      if (event.data?.type === 'CACHE_CLEARED') {
        window.location.reload();
      }
    };
    navigator.serviceWorker.controller.postMessage(
      { type: 'CLEAR_CACHE' },
      [messageChannel.port2]
    );
    // Timeout fallback after 1.5 seconds if the service worker fails to respond
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  } else {
    window.location.reload();
  }
}

async function fetchLatestBuildId() {
  const response = await fetch(`/app-version.json?updatedAt=${Date.now()}`, {
    cache: 'no-store',
  });

  if (!response.ok) return null;

  const payload = await response.json();
  return typeof payload.buildId === 'string' ? payload.buildId : null;
}

async function checkForAppVersionUpdate() {
  try {
    const latestBuildId = await fetchLatestBuildId();
    if (latestBuildId && latestBuildId !== __APP_BUILD_ID__) {
      reloadForAppUpdate();
    }
  } catch (error) {
    console.error('Error checking app update:', error);
  }
}

function activateWaitingServiceWorker(registration: ServiceWorkerRegistration) {
  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }
}

if (import.meta.env.PROD && 'serviceWorker' in navigator && !isPwaExcludedPath(window.location.pathname)) {
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
