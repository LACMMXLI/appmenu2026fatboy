import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, Smartphone, X } from 'lucide-react';
import { AuthView } from './views/AuthView';
import { RegisterView } from './views/RegisterView';
import { HomeView } from './views/HomeView';
import { MenuView } from './views/MenuView';
import { PromosView } from './views/PromosView';
import { CartView } from './views/CartView';
import { ProfileView } from './views/ProfileView';
import { ProductDetailView } from './views/ProductDetailView';
import { OrderTrackingView } from './views/OrderTrackingView';
import { RewardsView } from './views/RewardsView';
import { ChangePasswordView } from './views/ChangePasswordView';
import { PaymentMethodsView } from './views/PaymentMethodsView';
import { BranchesView } from './views/BranchesView';
import { AdminCatalogView } from './views/AdminCatalogView';
import { BranchOrdersView } from './views/BranchOrdersView';
import { GoogleReviewView } from './views/GoogleReviewView';
import { TopBar, BottomNav } from './components/layout/Navigation';
import { GoogleReviewPrompt } from './components/layout/GoogleReviewPrompt';
import { AppSplash } from './components/layout/AppSplash';
import { AnnouncementModal } from './components/layout/AnnouncementModal';
import { useUser } from './context/UserContext';
import { getSystemSettings, trackMenuVisit, type Product } from './lib/api';
import { GOOGLE_REVIEW_ROUTE, getGoogleReviewCooldown, isGoogleReviewRoutePath } from './lib/googleReviews';

const variants = {
  initial: { opacity: 0, y: 15 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, y: -15, transition: { duration: 0.2 } }
};

const fullScreenVariants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, scale: 1.02, transition: { duration: 0.3, ease: 'easeInOut' } }
};

const VISIT_TRACKED_SESSION_KEY = 'fatboy-menu-visit-tracked';
const INSTALL_PROMPT_DISMISSED_KEY = 'fatboy-pwa-install-dismissed-at';
const INSTALL_PROMPT_DISMISS_MS = 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function App() {
  const { isAuthenticated } = useUser();
  const isAdminCatalogPath = window.location.pathname === '/admin-catalog';
  const isBranchOrdersPath = window.location.pathname === '/branch-orders';
  const [currentView, setCurrentView] = useState(() =>
    isGoogleReviewRoutePath(window.location.pathname) ? 'google-review' : 'home'
  );
  const [pendingAuthView, setPendingAuthView] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(() => !sessionStorage.getItem('fatboy-app-splash-shown'));
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementDismissed, setAnnouncementDismissed] = useState(false);

  // Google Review prompt state & config URL
  const [googleReviewsUrl, setGoogleReviewsUrl] = useState('');
  const [showReviewPrompt, setShowReviewPrompt] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    if (isAdminCatalogPath || isBranchOrdersPath || sessionStorage.getItem(VISIT_TRACKED_SESSION_KEY)) {
      return;
    }

    sessionStorage.setItem(VISIT_TRACKED_SESSION_KEY, 'true');
    trackMenuVisit().catch((err) => {
      sessionStorage.removeItem(VISIT_TRACKED_SESSION_KEY);
      console.error('Error tracking menu visit:', err);
    });
  }, [isAdminCatalogPath, isBranchOrdersPath]);

  useEffect(() => {
    if (!showSplash) return;

    const timer = window.setTimeout(() => {
      sessionStorage.setItem('fatboy-app-splash-shown', 'true');
      setShowSplash(false);
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [showSplash]);

  useEffect(() => {
    if (!showSplash) {
      setShowAnnouncement(true);
    }
  }, [showSplash]);

  useEffect(() => {
    getSystemSettings()
      .then((settings) => {
        if (settings.google_reviews_url) {
          setGoogleReviewsUrl(settings.google_reviews_url);
        }
      })
      .catch((err) => console.error('Error fetching settings for review prompt:', err));
  }, []);

  useEffect(() => {
    if (isAdminCatalogPath || isBranchOrdersPath) return;
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone) {
      return;
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();

      const dismissedAt = Number(localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) || 0);
      if (Date.now() - dismissedAt < INSTALL_PROMPT_DISMISS_MS) return;

      setInstallPromptEvent(event as BeforeInstallPromptEvent);
      window.setTimeout(() => setShowInstallPrompt(true), 1800);
    };

    const handleAppInstalled = () => {
      setShowInstallPrompt(false);
      setInstallPromptEvent(null);
      localStorage.removeItem(INSTALL_PROMPT_DISMISSED_KEY);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [isAdminCatalogPath, isBranchOrdersPath]);

  useEffect(() => {
    if (announcementDismissed) {
      const timer = setTimeout(() => {
        setShowReviewPrompt(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [announcementDismissed]);

  const handleDismissPrompt = () => {
    setShowReviewPrompt(false);
  };

  const handleRedirectToGoogle = () => {
    navigate('google-review');
    setShowReviewPrompt(false);
  };

  const handleDismissInstallPrompt = () => {
    localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, Date.now().toString());
    setShowInstallPrompt(false);
  };

  const handleInstallApp = async () => {
    if (!installPromptEvent) return;

    setShowInstallPrompt(false);
    await installPromptEvent.prompt();
    const choice = await installPromptEvent.userChoice;
    if (choice.outcome === 'dismissed') {
      localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, Date.now().toString());
    }
    setInstallPromptEvent(null);
  };

  if (isAdminCatalogPath) {
    return <AdminCatalogView />;
  }

  if (isBranchOrdersPath) {
    return <BranchOrdersView />;
  }

  const isFullScreen = ['auth', 'register', 'product-detail', 'order-tracking', 'rewards', 'change-password', 'payment-methods', 'branches', 'google-review'].includes(currentView);
  const privateViews = ['rewards', 'change-password', 'payment-methods'];

  const navigate = (view: string, extra?: any) => {
    if (view === 'google-review' && !isGoogleReviewRoutePath(window.location.pathname)) {
      window.history.pushState(null, '', GOOGLE_REVIEW_ROUTE);
    }

    if (view !== 'google-review' && isGoogleReviewRoutePath(window.location.pathname)) {
      window.history.replaceState(null, '', '/');
    }

    if (privateViews.includes(view) && !isAuthenticated) {
      setPendingAuthView(view);
      setCurrentView('auth');
      return;
    }

    if (view === 'product-detail') {
      setSelectedProduct(extra ?? null);
    }

    if (view === 'menu') {
      if (typeof extra === 'string') {
        setSelectedCategoryId(extra);
      } else {
        setSelectedCategoryId(null);
      }
    }

    if (view !== 'auth' && view !== 'register') {
      setPendingAuthView(null);
    }

    setCurrentView(view);
  };

  const handleLogin = () => {
    setCurrentView(pendingAuthView ?? 'home');
    setPendingAuthView(null);
  };

  const handleRegister = () => {
    setCurrentView(pendingAuthView ?? 'profile');
    setPendingAuthView(null);
  };

  const renderFullScreenView = () => {
    switch (currentView) {
      case 'auth': return <motion.div key="auth" variants={fullScreenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 z-50 bg-background"><AuthView onNavigate={navigate} onLogin={handleLogin} /></motion.div>;
      case 'register': return <motion.div key="register" variants={fullScreenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 z-50 bg-background"><RegisterView onNavigate={navigate} onRegister={handleRegister} /></motion.div>;
      case 'product-detail': return <motion.div key="product-detail" variants={fullScreenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 z-50 bg-background"><ProductDetailView onNavigate={navigate} product={selectedProduct} /></motion.div>;
      case 'order-tracking': return <motion.div key="order-tracking" variants={fullScreenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 z-50 bg-background"><OrderTrackingView onNavigate={navigate} /></motion.div>;
      case 'rewards': return <motion.div key="rewards" variants={fullScreenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 z-50 bg-background"><RewardsView onNavigate={navigate} /></motion.div>;
      case 'change-password': return <motion.div key="change-password" variants={fullScreenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 z-50 bg-background"><ChangePasswordView onNavigate={navigate} /></motion.div>;
      case 'payment-methods': return <motion.div key="payment-methods" variants={fullScreenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 z-50 bg-background"><PaymentMethodsView onNavigate={navigate} /></motion.div>;
      case 'branches': return <motion.div key="branches" variants={fullScreenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 z-50 bg-background"><BranchesView onNavigate={navigate} /></motion.div>;
      case 'google-review': return <motion.div key="google-review" variants={fullScreenVariants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 z-50 bg-white text-black"><GoogleReviewView onNavigate={navigate} /></motion.div>;
      default: return null;
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-white w-full max-w-md mx-auto relative overflow-hidden font-sans">
      {/* Global Google Review overlay banner */}
      <AnimatePresence>
        {showReviewPrompt && (
          <GoogleReviewPrompt
            onClose={handleDismissPrompt}
            onRedirect={handleRedirectToGoogle}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isFullScreen && renderFullScreenView()}
      </AnimatePresence>

      {!isFullScreen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-[100dvh]">
          <TopBar onNavigate={navigate} />
          <div className="flex-1 relative overflow-hidden">
            <AnimatePresence mode="wait">
              {currentView === 'home' && (
                <motion.div key="home" variants={variants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 flex flex-col">
                  <HomeView onNavigate={navigate} />
                </motion.div>
              )}
              {currentView === 'menu' && (
                <motion.div key="menu" variants={variants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 flex flex-col">
                  <MenuView onNavigate={navigate} initialCategoryId={selectedCategoryId} />
                </motion.div>
              )}
              {currentView === 'promos' && (
                <motion.div key="promos" variants={variants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 flex flex-col">
                  <PromosView onNavigate={navigate} />
                </motion.div>
              )}
              {currentView === 'cart' && (
                <motion.div key="cart" variants={variants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 flex flex-col">
                  <CartView onNavigate={navigate} />
                </motion.div>
              )}
              {currentView === 'profile' && (
                <motion.div key="profile" variants={variants} initial="initial" animate="animate" exit="exit" className="absolute inset-0 flex flex-col">
                  <ProfileView onNavigate={navigate} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <BottomNav currentView={currentView} onNavigate={navigate} />
        </motion.div>
      )}

      <AnimatePresence>
        {showSplash && <AppSplash />}
      </AnimatePresence>

      <AnimatePresence>
        {showAnnouncement && (
          <AnnouncementModal
            onClose={() => {
              setShowAnnouncement(false);
              setAnnouncementDismissed(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showInstallPrompt && installPromptEvent && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-5 left-4 right-4 z-[9998] rounded-2xl border border-white/10 bg-[#181818]/95 p-4 shadow-[0_18px_45px_rgba(0,0,0,0.55)] backdrop-blur-xl"
          >
            <button
              type="button"
              onClick={handleDismissInstallPrompt}
              className="absolute right-3 top-3 rounded-full p-1 text-gray-500 transition-colors hover:text-white"
              aria-label="Cerrar instalación"
            >
              <X size={16} />
            </button>
            <div className="flex gap-3 pr-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Smartphone size={22} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Instalar app</p>
                <h3 className="mt-0.5 text-sm font-black text-white">Fatboy App en tu pantalla</h3>
                <p className="mt-1 text-xs font-medium leading-snug text-gray-400">
                  Accede más rápido al menú sin buscar la página en el navegador.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleInstallApp}
              className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary text-xs font-black uppercase text-white shadow-[0_0_18px_rgba(232,0,10,0.25)] transition-transform active:scale-[0.98]"
            >
              <Download size={16} /> Descargar aplicación
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

}
