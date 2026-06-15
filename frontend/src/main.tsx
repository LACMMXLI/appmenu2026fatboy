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

function isPwaExcludedPath(pathname: string) {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  return PWA_EXCLUDED_PATHS.some((path) => normalized === path || normalized.startsWith(`${path}/`));
}

if (import.meta.env.PROD && 'serviceWorker' in navigator && !isPwaExcludedPath(window.location.pathname)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((error) => console.error('Error registering service worker:', error));
  });
}
